/** Extracts lexical marker identities and relationship predicates across source and packed imports. @module */
import type * as Ast from '@oxc-project/types'
import * as Lightning from 'lightningcss'
import * as Walker from 'oxc-walker'
import * as Marker from '../../runtime/Marker.js'
import * as Relationships from '../../web/internal/Relationships.js'
import * as Theme from '../../Theme.js'
import * as Condition from '../../internal/Condition.js'
import * as Expression from './Expression.js'
import type * as Scope from './Scope.js'
import * as Themes from './Themes.js'

/** Marker factory span retained for runtime rewriting. */
export type Call = {
  readonly start: number
  readonly end: number
  readonly definition: Marker.Definition
}

/** Parses a composed relationship selector and rejects grammar browsers drop or never match. */
function validate(selector: string): void {
  Lightning.transform({
    filename: 'marker.css',
    code: new TextEncoder().encode(`.z{${selector}{color:red}}`),
    errorRecovery: false,
    visitor: {
      Selector(value) {
        check(value, false)
      },
    },
  })
}

function check(selector: Lightning.Selector, within: boolean): void {
  for (const component of selector) {
    if (component.type !== 'pseudo-class') continue

    if (component.kind === 'custom' || component.kind === 'custom-function')
      throw new Error(`Unknown pseudo-class :${component.name}.`)

    if (component.kind === 'has') {
      if (within) throw new Error('CSS forbids nested :has().')

      for (const inner of component.selectors) check(inner, true)
      continue
    }

    if (component.kind === 'visited' && within)
      throw new Error(':visited never matches inside :has().')

    if (
      component.kind === 'where' ||
      component.kind === 'is' ||
      component.kind === 'not' ||
      component.kind === 'any'
    )
      for (const inner of component.selectors) check(inner, within)
    else if (
      (component.kind === 'nth-child' || component.kind === 'nth-last-child') &&
      component.of
    )
      for (const inner of component.of) check(inner, within)
    else if (component.kind === 'host' && component.selectors)
      check(component.selectors, within)
  }
}

/** Collects statically declared markers and scoped relationship conditions. */
export function scan(
  program: Ast.Program,
  scope: Scope.Tracker,
  namespace: string,
  links: Readonly<Record<string, Themes.Link>> = {},
) {
  const namespaces = new Set<number>()
  const modules = new Set<number>()
  const helpers = new Map<number, string>()
  const helperNames = ['ref', 'where']
  const bindings = new Map<number, Themes.Link>()
  const names = new Map<string, Themes.Link>()
  const exports: Record<string, Themes.Link> = Object.create(null)
  const calls: Call[] = []
  const conditions = new Map<number, string>()
  const applications = new Map<number, Relationships.Part>()

  for (const statement of program.body) {
    if (
      statement.type !== 'ImportDeclaration' ||
      statement.importKind === 'type'
    )
      continue

    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.importKind !== 'type' &&
        statement.source.value === 'zyzz/web'
      ) {
        const name =
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value
        if (helperNames.includes(name)) helpers.set(specifier.start, name)
      }

      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.importKind !== 'type' &&
        statement.source.value === 'zyzz/web' &&
        (specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value) === 'Css'
      )
        namespaces.add(specifier.start)

      if (
        specifier.type === 'ImportNamespaceSpecifier' &&
        statement.source.value === 'zyzz/web'
      )
        modules.add(specifier.start)

      const link = links[specifier.local.name]

      if (link?.kind === 'marker') {
        bindings.set(specifier.start, {
          ...link,
          call: { ...link.call, start: -1, end: -1 },
        })
        names.set(specifier.local.name, link)
      }
    }
  }

  if (!namespaces.size && !bindings.size && !modules.size && !helpers.size)
    return { calls, conditions, exports }

  function data(node: Ast.Node): unknown {
    node = Expression.unwrap(node)

    if (node.type === 'Literal') return node.value

    if (node.type === 'TemplateLiteral' && !node.expressions.length)
      return node.quasis[0]!.value.cooked

    if (
      node.type === 'Identifier' &&
      node.name === 'undefined' &&
      !scope.getDeclaration(node.name)
    )
      return undefined

    if (node.type === 'ArrayExpression')
      return node.elements.map((element) => {
        if (!element || element.type === 'SpreadElement')
          throw new Themes.InvalidError(
            'Marker arrays require dense literal values.',
            node,
          )

        return data(element)
      })

    if (node.type === 'ObjectExpression') {
      const result: Record<string, unknown> = Object.create(null)

      for (const property of node.properties) {
        if (
          property.type !== 'Property' ||
          property.computed ||
          property.method ||
          property.kind !== 'init' ||
          property.shorthand
        )
          throw new Themes.InvalidError(
            'Markers require explicit static properties.',
            property,
          )

        const key =
          property.key.type === 'Identifier'
            ? property.key.name
            : property.key.type === 'Literal'
              ? String(property.key.value)
              : undefined
        if (key === undefined || Object.hasOwn(result, key))
          throw new Themes.InvalidError(
            'Marker properties require unique literal keys.',
            property,
          )

        result[key] = data(property.value)
      }

      return result
    }

    throw new Themes.InvalidError(
      'Marker conditions require literal data.',
      node,
    )
  }

  function method(node: Ast.Node): string | undefined {
    if (node.type === 'Identifier') {
      const binding = scope.getDeclaration(node.name)
      return binding?.type === 'Import'
        ? helpers.get(binding.node.start)
        : undefined
    }

    if (node.type === 'MemberExpression' && node.object.type === 'Identifier') {
      const binding = scope.getDeclaration(node.object.name)

      if (binding?.type === 'Import' && modules.has(binding.node.start)) {
        const key =
          node.property.type === 'Identifier' && !node.computed
            ? node.property.name
            : node.property.type === 'Literal'
              ? node.property.value
              : undefined
        if (typeof key === 'string' && helperNames.includes(key))
          throw new Themes.InvalidError(
            'Relationship helpers require direct named imports from zyzz/web.',
            node,
          )
        if (key === 'Css' || key === undefined)
          throw new Themes.InvalidError(
            'Marker helpers require the named Css import from zyzz/web.',
            node,
          )
      }
    }

    if (node.type !== 'MemberExpression' || node.object.type !== 'Identifier')
      return undefined

    const declaration = scope.getDeclaration(node.object.name)
    if (
      declaration?.type !== 'Import' ||
      !namespaces.has(declaration.node.start)
    )
      return undefined

    if (node.optional)
      throw new Themes.InvalidError(
        'Marker helpers require direct calls.',
        node,
      )

    if (!node.computed && node.property.type === 'Identifier')
      return node.property.name

    if (
      node.computed &&
      node.property.type === 'Literal' &&
      typeof node.property.value === 'string'
    )
      return node.property.value

    throw new Themes.InvalidError(
      'Marker helpers require static property names.',
      node,
    )
  }

  function resolve(node: Ast.Node): Themes.Link | undefined {
    node = Expression.unwrap(node)

    if (node.type !== 'Identifier') return undefined

    const declaration = scope.getDeclaration(node.name)

    return declaration ? bindings.get(declaration.node.start) : undefined
  }

  const ancestors: Ast.Node[] = []

  Walker.walk(program, {
    scopeTracker: scope,
    enter(node) {
      ancestors.push(node)

      if (
        node.type === 'VariableDeclarator' &&
        node.id.type === 'ObjectPattern' &&
        node.init
      ) {
        const init = Expression.unwrap(node.init)
        const declaration =
          init.type === 'Identifier'
            ? scope.getDeclaration(init.name)
            : undefined
        if (
          declaration?.type === 'Import' &&
          namespaces.has(declaration.node.start) &&
          node.id.properties.some(
            (property) =>
              property.type === 'RestElement' ||
              (property.computed && property.key.type !== 'Literal') ||
              helperNames.includes(
                property.key.type === 'Identifier'
                  ? property.key.name
                  : property.key.type === 'Literal' &&
                      typeof property.key.value === 'string'
                    ? property.key.value
                    : '',
              ),
          )
        )
          throw new Themes.InvalidError(
            'Marker helpers require direct Css member calls.',
            node,
          )
      }

      if (
        node.type === 'VariableDeclarator' &&
        node.id.type === 'Identifier' &&
        node.init
      ) {
        const init = Expression.unwrap(node.init)
        const owner = ancestors.at(-2)
        const statement = ancestors.at(-3)
        const link = resolve(init)

        if (link) {
          if (owner?.type !== 'VariableDeclaration' || owner.kind !== 'const')
            return

          bindings.set(node.id.start, link)

          if (
            statement?.type === 'Program' ||
            statement?.type === 'ExportNamedDeclaration'
          )
            names.set(node.id.name, link)

          if (statement?.type === 'ExportNamedDeclaration')
            exports[node.id.name] = link
        } else if (
          init.type === 'CallExpression' &&
          !init.optional &&
          init.arguments.length <= 1 &&
          owner?.type === 'VariableDeclaration' &&
          owner.kind === 'const'
        ) {
          // Statically applied refs stay interpolable; dynamic applications remain runtime-only.
          const target = resolve(init.callee)

          if (
            target?.call.marker &&
            !(target.call.start >= 0 && init.start < target.call.end)
          )
            try {
              applications.set(node.id.start, {
                marker: target.call.marker,
                state: init.arguments[0] ? data(init.arguments[0]) : {},
              })
            } catch {
              applications.delete(node.id.start)
            }
        }
      }

      if (
        node.type === 'MemberExpression' ||
        (node.type === 'Identifier' &&
          ancestors.at(-2) &&
          Walker.isReferenceIdentifier(node, ancestors.at(-2)!) &&
          !ancestors.some((value) =>
            [
              'TSTypeQuery',
              'TSTypeReference',
              'TSQualifiedName',
              'TSTypeAnnotation',
            ].includes(value.type),
          ))
      ) {
        const name = method(node)
        const container = ancestors.at(-2)

        if (
          (name === 'ref' &&
            (container?.type !== 'CallExpression' ||
              container.callee !== node)) ||
          (name === 'where' &&
            (container?.type !== 'TaggedTemplateExpression' ||
              container.tag !== node))
        )
          throw new Themes.InvalidError(
            'Marker helpers require direct calls.',
            node,
          )
      }

      if (node.type === 'TaggedTemplateExpression') {
        if (method(node.tag) !== 'where') return

        const property = ancestors.findLast(
          (value) =>
            value.type === 'Property' && Expression.unwrap(value.key) === node,
        )
        if (property?.type !== 'Property' || !property.computed)
          throw new Themes.InvalidError(
            'Relationship selectors must be computed style keys.',
            node,
          )
        if (node.typeArguments)
          throw new Themes.InvalidError(
            'Relationship selectors do not accept type arguments.',
            node,
          )

        try {
          const parts = node.quasi.expressions.map(
            (expression): Relationships.Part => {
              const value = Expression.unwrap(expression)
              const call = value.type === 'CallExpression' ? value : undefined
              const link = resolve(call ? call.callee : value)

              if (!link && value.type === 'Identifier') {
                const declaration = scope.getDeclaration(value.name)
                const application = declaration
                  ? applications.get(declaration.node.start)
                  : undefined

                if (application) return application
              }

              if (
                !link?.call.marker ||
                (call && (call.arguments.length > 1 || call.optional)) ||
                (link.call.start >= 0 && node.start < link.call.end)
              )
                throw new Themes.InvalidError(
                  'Relationship selectors interpolate previously declared refs or ref applications.',
                  expression,
                )

              return {
                marker: link.call.marker,
                state: call?.arguments[0] ? data(call.arguments[0]) : {},
              }
            },
          )

          const quasis = node.quasi.quasis.map((quasi) => {
            if (quasi.value.cooked === null || quasi.value.cooked === undefined)
              throw new Themes.InvalidError(
                'Relationship selectors require valid template escapes.',
                quasi,
              )

            return quasi.value.cooked
          })

          const selector = Relationships.compose(quasis, parts)

          validate(selector)
          Condition.normalize(selector)
          conditions.set(node.start, selector)
        } catch (error) {
          if (error instanceof Themes.InvalidError) throw error

          throw new Themes.InvalidError((error as Error).message, node)
        }

        return
      }

      if (node.type !== 'CallExpression') return

      const name = method(node.callee)

      if (name === 'ref') {
        const index = ancestors.findLastIndex(
          (value) =>
            value.type === 'VariableDeclarator' &&
            value.init !== null &&
            Expression.unwrap(value.init) === node,
        )

        const owner = ancestors[index]
        const variable =
          owner?.type === 'VariableDeclarator' ? owner : undefined
        const declaration = ancestors[index - 1]
        const statement = ancestors[index - 2]
        if (
          !variable ||
          variable.id.type !== 'Identifier' ||
          declaration?.type !== 'VariableDeclaration' ||
          declaration.kind !== 'const' ||
          (statement?.type !== 'Program' &&
            statement?.type !== 'ExportNamedDeclaration') ||
          node.arguments.length > 1 ||
          node.optional
        )
          throw new Themes.InvalidError(
            'Markers require module-level const factory bindings.',
            node,
          )

        try {
          const input = node.arguments[0] ? data(node.arguments[0]) : undefined
          const schema = Marker.schema(input === undefined ? {} : input)

          const id =
            `data-z-${namespace}-${variable.id.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}-${Array.from(
              variable.id.name,
            )
              .map((char) => char.codePointAt(0)!.toString(16))
              .join('-')}` as const

          const definition = Object.freeze({ id, schema })

          const link: Themes.Link = {
            binding: id,
            kind: 'marker',
            definition: Theme.define({}),
            call: {
              start: node.start,
              end: node.end,
              name: id,
              tokenType: '{}',
              marker: definition,
            },
          }

          bindings.set(variable.id.start, link)
          names.set(variable.id.name, link)
          calls.push({ start: node.start, end: node.end, definition })

          if (statement?.type === 'ExportNamedDeclaration')
            exports[variable.id.name] = link
        } catch (error) {
          if (error instanceof Themes.InvalidError) throw error

          throw new Themes.InvalidError((error as Error).message, node)
        }
      }
    },
    leave() {
      ancestors.pop()
    },
  })

  for (const statement of program.body) {
    if (
      statement.type !== 'ExportNamedDeclaration' ||
      statement.source ||
      statement.exportKind === 'type'
    )
      continue

    for (const specifier of statement.specifiers) {
      if (specifier.exportKind === 'type') continue

      const name =
        specifier.local.type === 'Identifier'
          ? specifier.local.name
          : specifier.local.value
      const link = names.get(name)

      if (link)
        exports[
          specifier.exported.type === 'Identifier'
            ? specifier.exported.name
            : specifier.exported.value
        ] = link
    }
  }

  return { calls, conditions, exports }
}
