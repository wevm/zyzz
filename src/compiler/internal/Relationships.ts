/** Extracts where relationship selectors from css definition interpolations across source and packed imports. @module */
import type * as Ast from '@oxc-project/types'
import * as Lightning from 'lightningcss'
import * as Walker from 'oxc-walker'
import * as Relationships from '../../web/internal/Relationships.js'
import * as Theme from '../../Theme.js'
import * as Condition from '../../internal/Condition.js'
import * as Expression from './Expression.js'
import type * as Scope from './Scope.js'
import * as Themes from './Themes.js'

/** Statically located css definition; packed imports carry no local call start. */
type Definition = {
  readonly name: string
  readonly start: number | undefined
}

type Group = Map<string, Definition>

/** Parses a composed relationship selector and rejects grammar browsers drop or never match. */
function validate(selector: string): void {
  Lightning.transform({
    filename: 'relationship.css',
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

/** Collects where selectors and the css definitions they and packed consumers may reference. */
export function scan(
  program: Ast.Program,
  scope: Scope.Tracker,
  namespace: string,
  links: Readonly<Record<string, Themes.Link>> = {},
) {
  const tags = new Set<number>()
  const modules = new Set<number>()
  const imported = new Map<number, Themes.Link>()
  const conditions = new Map<number, string>()
  const references = new Map<number, readonly number[]>()

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
        statement.source.value === 'zyzz/web' &&
        (specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value) === 'where'
      )
        tags.add(specifier.start)

      if (
        specifier.type === 'ImportNamespaceSpecifier' &&
        statement.source.value === 'zyzz/web'
      )
        modules.add(specifier.start)

      const link = links[specifier.local.name]
      if (link?.kind === 'style') imported.set(specifier.start, link)
    }
  }

  // Module-level definitions by name, plus every declaring node start that
  // the scope tracker may report for them.
  const named = new Map<string, Definition | Group>()
  const declared = new Set<number>()
  const exported = new Map<string, string>()

  function definition(node: Ast.Node): Definition | undefined {
    const value = Expression.unwrap(node)
    if (value.type !== 'CallExpression' || value.optional) return undefined

    return { name: `style-${namespace}-${value.start}`, start: value.start }
  }

  function register(
    name: string,
    starts: readonly number[],
    value: Definition | Group,
    isExported: boolean,
  ) {
    named.set(name, value)
    for (const start of starts) declared.add(start)
    if (isExported) exported.set(name, name)
  }

  for (const statement of program.body) {
    const isExported = statement.type === 'ExportNamedDeclaration'
    const declaration = isExported ? statement.declaration : statement

    if (isExported && !statement.source)
      for (const specifier of statement.specifiers) {
        if (specifier.exportKind === 'type') continue

        exported.set(
          specifier.local.type === 'Identifier'
            ? specifier.local.name
            : specifier.local.value,
          specifier.exported.type === 'Identifier'
            ? specifier.exported.name
            : specifier.exported.value,
        )
      }

    if (
      declaration?.type === 'TSModuleDeclaration' &&
      declaration.id.type === 'Identifier' &&
      declaration.body?.type === 'TSModuleBlock'
    ) {
      const members = new Map<string, Definition>()

      for (const member of declaration.body.body) {
        const inner =
          member.type === 'ExportNamedDeclaration' ? member.declaration : member
        if (inner?.type !== 'VariableDeclaration' || inner.kind !== 'const')
          continue

        for (const declarator of inner.declarations) {
          if (declarator.id.type !== 'Identifier' || !declarator.init) continue

          const value = definition(declarator.init)
          if (value) members.set(declarator.id.name, value)
        }
      }

      register(
        declaration.id.name,
        [statement.start, declaration.start, declaration.id.start],
        members,
        isExported,
      )
      continue
    }

    if (
      declaration?.type !== 'VariableDeclaration' ||
      declaration.kind !== 'const'
    )
      continue

    for (const declarator of declaration.declarations) {
      if (declarator.id.type !== 'Identifier' || !declarator.init) continue

      const direct = definition(declarator.init)
      const starts = [declarator.start, declarator.id.start]

      if (direct) {
        register(declarator.id.name, starts, direct, isExported)
        continue
      }

      const init = Expression.unwrap(declarator.init)
      if (init.type !== 'ObjectExpression') continue

      const members = new Map<string, Definition>()

      for (const property of init.properties) {
        if (
          property.type !== 'Property' ||
          property.computed ||
          property.method ||
          property.kind !== 'init' ||
          property.key.type !== 'Identifier'
        )
          continue

        const value = definition(property.value)
        if (value) members.set(property.key.name, value)
      }

      if (members.size)
        register(declarator.id.name, starts, members, isExported)
    }
  }

  if (!tags.size && !modules.size && !exported.size)
    return { conditions, references, exports: () => ({}) }

  function isTag(node: Ast.Node): boolean {
    const value = Expression.unwrap(node)

    if (value.type === 'Identifier') {
      const declaration = scope.getDeclaration(value.name)
      return declaration?.type === 'Import' && tags.has(declaration.node.start)
    }

    if (
      value.type === 'MemberExpression' &&
      value.object.type === 'Identifier'
    ) {
      const declaration = scope.getDeclaration(value.object.name)
      const key =
        value.property.type === 'Identifier' && !value.computed
          ? value.property.name
          : value.property.type === 'Literal'
            ? value.property.value
            : undefined

      if (
        declaration?.type === 'Import' &&
        modules.has(declaration.node.start) &&
        key === 'where'
      )
        throw new Themes.InvalidError(
          'Relationship helpers require direct named imports from zyzz/web.',
          value,
        )
    }

    return false
  }

  function resolve(node: Ast.Node): Definition | undefined {
    const value = Expression.unwrap(node)

    if (value.type === 'Identifier') {
      const declaration = scope.getDeclaration(value.name)

      if (declaration?.type === 'Import') {
        const link = imported.get(declaration.node.start)
        return link && !link.members
          ? { name: link.call.name, start: undefined }
          : undefined
      }

      const local = named.get(value.name)
      if (!local || local instanceof Map) return undefined
      if (declaration && !declared.has(declaration.node.start)) return undefined

      return local
    }

    if (
      value.type !== 'MemberExpression' ||
      value.computed ||
      value.optional ||
      value.object.type !== 'Identifier' ||
      value.property.type !== 'Identifier'
    )
      return undefined

    const declaration = scope.getDeclaration(value.object.name)

    if (declaration?.type === 'Import') {
      const member = imported.get(declaration.node.start)?.members?.[
        value.property.name
      ]
      return member ? { name: member.call.name, start: undefined } : undefined
    }

    const group = named.get(value.object.name)
    if (!(group instanceof Map)) return undefined
    if (declaration && !declared.has(declaration.node.start)) return undefined

    return group.get(value.property.name)
  }

  const ancestors: Ast.Node[] = []

  Walker.walk(program, {
    scopeTracker: scope,
    enter(node) {
      ancestors.push(node)

      const parent = ancestors.at(-2)

      if (
        node.type === 'Identifier' &&
        parent &&
        Walker.isReferenceIdentifier(node, parent) &&
        !ancestors.some((value) =>
          [
            'TSTypeQuery',
            'TSTypeReference',
            'TSQualifiedName',
            'TSTypeAnnotation',
          ].includes(value.type),
        )
      ) {
        const declaration = scope.getDeclaration(node.name)

        if (
          declaration?.type === 'Import' &&
          tags.has(declaration.node.start) &&
          !(parent.type === 'TaggedTemplateExpression' && parent.tag === node)
        )
          throw new Themes.InvalidError(
            'Relationship selectors require direct where templates.',
            node,
          )
      }

      if (node.type === 'MemberExpression') isTag(node)

      if (node.type !== 'TaggedTemplateExpression' || !isTag(node.tag)) return

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
        const definitions = node.quasi.expressions.map((expression) => {
          const value = resolve(expression)

          if (!value)
            throw new Themes.InvalidError(
              'Relationship selectors interpolate module-level css definitions.',
              expression,
            )

          return value
        })

        const quasis = node.quasi.quasis.map((quasi) => {
          if (quasi.value.cooked === null || quasi.value.cooked === undefined)
            throw new Themes.InvalidError(
              'Relationship selectors require valid template escapes.',
              quasi,
            )

          return quasi.value.cooked
        })

        const selector = Relationships.compose(
          quasis,
          definitions.map((value) => ({
            className: Relationships.identity(value.name),
          })),
        )

        validate(selector)
        Condition.normalize(selector)
        conditions.set(node.start, selector)
        references.set(
          node.start,
          definitions.flatMap((value) =>
            value.start === undefined ? [] : [value.start],
          ),
        )
      } catch (error) {
        if (error instanceof Themes.InvalidError) throw error

        throw new Themes.InvalidError((error as Error).message, node)
      }
    },
    leave() {
      ancestors.pop()
    },
  })

  /** Publishes definitions that compiled as css so packed consumers can interpolate them. */
  function exports(compiled: ReadonlySet<number>): Record<string, Themes.Link> {
    const result: Record<string, Themes.Link> = Object.create(null)

    const link = (value: Definition): Themes.Link | undefined =>
      value.start !== undefined && compiled.has(value.start)
        ? {
            binding: value.name,
            kind: 'style',
            definition: Theme.define({}),
            call: { start: -1, end: -1, name: value.name, tokenType: '{}' },
          }
        : undefined

    for (const [local, name] of exported) {
      const value = named.get(local)
      if (!value) continue

      if (!(value instanceof Map)) {
        const entry = link(value)
        if (entry) result[name] = entry
        continue
      }

      const members: Record<string, Themes.Link> = Object.create(null)

      for (const [key, member] of value) {
        const entry = link(member)
        if (entry) members[key] = entry
      }

      if (Object.keys(members).length)
        result[name] = {
          binding: `${namespace}-${local}`,
          kind: 'style',
          definition: Theme.define({}),
          call: { start: -1, end: -1, name: '', tokenType: '{}' },
          members,
        }
    }

    return result
  }

  return { conditions, references, exports }
}
