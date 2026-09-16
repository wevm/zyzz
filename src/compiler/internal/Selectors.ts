/** Resolves selector objects and portable style definition identities. @module */
import type * as Ast from '@oxc-project/types'
import * as Walker from 'oxc-walker'
import * as Condition from '../../internal/Condition.js'
import * as Theme from '../../Theme.js'
import * as AtRules from './AtRules.js'
import * as Identity from '../../internal/Identity.js'
import * as Identifiers from './Identifiers.js'
import * as Expression from './Expression.js'
import type * as Scope from './Scope.js'
import * as Themes from './Themes.js'

/** Collects scoped selectors, local identities, and exported style references. */
export function scan(
  program: Ast.Program,
  scope: Scope.Tracker,
  namespace: string,
  calls: readonly Ast.CallExpression[],
  links: Readonly<Record<string, Themes.Link>> = {},
  selectorKeys: ReadonlySet<number> = new Set(),
) {
  const conditions = new Map<number, string>()
  const localConditions = new Set<string>()
  const identities = new Map<number, string>()
  const exports: Record<string, Themes.Link> = Object.create(null)
  const definitions = new Map(calls.map((call) => [call.start, call]))
  const declarations = new Map<number, number>()
  const bindings = new Map<number, Ast.Expression>()
  const namespaces = new Map<number, Map<string, Ast.Expression>>()
  const importedNames = new Map<string, Themes.Link>()
  const imported = new Map<number, Themes.Link>()

  const names = new Map<string, Ast.Expression>()
  const publicNames = new Map<string, string>()
  const namespaceNames = new Map<string, Map<string, Ast.Expression>>()
  const publicNamespaces = new Map<string, Map<string, Ast.Expression>>()

  function members(node: Ast.TSModuleDeclaration | Ast.TSGlobalDeclaration) {
    const result = new Map<string, Ast.Expression>()
    if (node.body?.type !== 'TSModuleBlock') return result

    for (const statement of node.body.body) {
      if (statement.type !== 'ExportNamedDeclaration') continue
      const declaration = statement.declaration
      if (
        declaration?.type !== 'VariableDeclaration' ||
        declaration.kind !== 'const'
      )
        continue

      for (const variable of declaration.declarations)
        if (variable.id.type === 'Identifier' && variable.init)
          result.set(variable.id.name, variable.init)
    }

    return result
  }

  for (const statement of program.body) {
    if (
      statement.type === 'ImportDeclaration' &&
      statement.importKind !== 'type'
    )
      for (const specifier of statement.specifiers) {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.importKind === 'type'
        )
          continue
        const link = links[specifier.local.name]
        if (link?.kind === 'style-reference') {
          imported.set(specifier.start, link)
          importedNames.set(specifier.local.name, link)
        }
      }

    const declaration =
      statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement
    if (
      declaration?.type === 'VariableDeclaration' &&
      declaration.kind === 'const'
    )
      for (const variable of declaration.declarations)
        if (variable.id.type === 'Identifier' && variable.init) {
          names.set(variable.id.name, variable.init)
          if (statement.type === 'ExportNamedDeclaration')
            publicNames.set(variable.id.name, variable.id.name)
        }

    if (
      declaration?.type === 'TSModuleDeclaration' &&
      declaration.id.type === 'Identifier' &&
      declaration.kind !== 'global'
    ) {
      namespaceNames.set(declaration.id.name, members(declaration))
      if (statement.type === 'ExportNamedDeclaration')
        publicNamespaces.set(declaration.id.name, members(declaration))
    }

    if (
      statement.type === 'ExportNamedDeclaration' &&
      !statement.source &&
      statement.exportKind !== 'type'
    )
      for (const specifier of statement.specifiers) {
        if (specifier.exportKind === 'type') continue
        publicNames.set(
          specifier.exported.type === 'Identifier'
            ? specifier.exported.name
            : specifier.exported.value,
          specifier.local.type === 'Identifier'
            ? specifier.local.name
            : specifier.local.value,
        )
      }
  }

  if (!calls.length && !imported.size)
    return { conditions, exports, identities, localConditions }

  const exposed = new Map<Ast.Expression, readonly (readonly string[])[]>()
  for (const [name, local] of publicNames) {
    const imported = importedNames.get(local)
    if (imported) exports[name] = imported

    const value = names.get(local)
    if (value) exposed.set(value, [...(exposed.get(value) ?? []), [name]])
    const namespace = namespaceNames.get(local)
    if (namespace) publicNamespaces.set(name, namespace)
  }
  for (const [name, values] of publicNamespaces)
    for (const [member, value] of values)
      exposed.set(value, [...(exposed.get(value) ?? []), [name, member]])

  type Entry = { node: Ast.Node; parent: Ast.Node | null | undefined }
  const nodes: Entry[] = []
  Walker.walk(program, {
    scopeTracker: scope,
    enter(node, parent) {
      if (node.type === 'Property' && selectorKeys.has(node.key.start))
        nodes.push({ node, parent })
      if (node.type === 'VariableDeclarator') nodes.push({ node, parent })

      if (node.type === 'Identifier') {
        const declaration = scope.getDeclaration(node.name)
        if (declaration) declarations.set(node.start, declaration.node.start)
      }

      if (node.type === 'VariableDeclaration' && node.kind === 'const')
        for (const variable of node.declarations)
          if (variable.id.type === 'Identifier' && variable.init)
            bindings.set(variable.id.start, variable.init)

      if (node.type === 'TSModuleDeclaration' && node.id.type === 'Identifier')
        namespaces.set(node.id.start, members(node))
    },
  })

  function link(call: Ast.CallExpression): Themes.Link {
    const id = Identifiers.explicit(call)
    const name = `z-style-${id === undefined ? `${namespace}-${call.start}` : Identity.requireId(id, 'style')}`
    identities.set(call.start, name)

    return {
      binding: name,
      call: { start: call.start, end: call.end, name, tokenType: '{}' },
      definition: Theme.define({}),
      kind: 'style-reference',
    }
  }

  function resolve(
    node: Ast.Node,
    seen = new Set<Ast.Node>(),
  ): Themes.Link | undefined {
    node = Expression.unwrap(node)
    if (seen.has(node)) return undefined
    seen.add(node)

    if (
      node.type === 'CallExpression' &&
      definitions.get(node.start)?.end === node.end
    )
      return link(node)

    if (node.type === 'Identifier') {
      const declaration = declarations.get(node.start)
      if (declaration === undefined) return undefined
      const external = imported.get(declaration)
      if (external) return external
      const value = bindings.get(declaration)
      return value ? resolve(value, seen) : undefined
    }

    if (node.type === 'MemberExpression' && !node.optional) {
      const name = (() => {
        if (!node.computed && node.property.type === 'Identifier')
          return node.property.name
        if (
          node.property.type === 'Literal' &&
          typeof node.property.value === 'string'
        )
          return node.property.value
        return undefined
      })()
      if (name === undefined) return undefined

      if (node.object.type === 'Identifier') {
        const declaration = declarations.get(node.object.start)
        const value =
          declaration === undefined
            ? undefined
            : namespaces.get(declaration)?.get(name)
        if (value) return resolve(value, seen)
      }
      return resolve(node.object, seen)?.members?.[name]
    }

    return undefined
  }

  for (const { node } of nodes) {
    if (node.type === 'VariableDeclarator' && node.init)
      for (const [key, member] of exposed.get(node.init) ?? []) {
        const resolved = resolve(node.init)
        if (!resolved || key === undefined) continue

        if (member === undefined) exports[key] = resolved
        else {
          const previous = exports[key]
          const name = Array.from(key, (char) =>
            char.codePointAt(0)!.toString(16),
          ).join('-')
          exports[key] = {
            binding: `z-style-${namespace}-namespace-${name}`,
            call: { start: -1, end: -1, name: '', tokenType: '{}' },
            definition: Theme.define({}),
            kind: 'style-reference',
            members: { ...previous?.members, [member]: resolved },
          }
        }
      }

    if (node.type !== 'Property') continue
    if (node.method || node.kind !== 'init' || node.shorthand)
      throw new Themes.InvalidError(
        'Selectors require explicit string keys and style objects.',
        node,
      )
    const key = Expression.unwrap(node.key)
    let selector = ''
    if (key.type === 'Literal' && typeof key.value === 'string')
      selector = key.value
    else if (key.type === 'TemplateLiteral' && node.computed) {
      selector = key.quasis[0]!.value.cooked ?? ''
      for (const [index, expression] of key.expressions.entries()) {
        const value = Expression.unwrap(expression)
        if (value.type !== 'Identifier' && value.type !== 'MemberExpression')
          throw new Themes.InvalidError(
            'Selector interpolations require style definitions without calling them.',
            expression,
          )
        const reference = resolve(value)
        if (
          !reference ||
          reference.members ||
          (reference.call.start >= 0 &&
            reference.call.end > node.start &&
            !importedHas(reference))
        )
          throw new Themes.InvalidError(
            'Selector interpolations require previously declared style definitions.',
            expression,
          )
        selector += `.${reference.call.name}${key.quasis[index + 1]!.value.cooked ?? ''}`
      }
    } else
      throw new Themes.InvalidError(
        'Selectors require literal strings or templates referencing style definitions.',
        key,
      )
    try {
      if (!Condition.nested(selector) || selector.trimStart().startsWith('@'))
        throw new Error('Selectors require an explicit & target.')
      selector = Condition.normalize(selector)
      let local = false
      AtRules.transform({
        filename: 'selectors.css',
        code: new TextEncoder().encode(`.z{${selector}{color:red}}`),
        errorRecovery: false,
        visitor: {
          Rule(rule) {
            if (rule.type !== 'style') return
            const selectors = rule.value.selectors
            if (
              !selectors.some((parts) =>
                parts.some((part) => part.type === 'nesting'),
              )
            )
              return
            local = selectors.every((parts) => {
              const last = parts.findLastIndex(
                (part) => part.type === 'combinator',
              )
              return parts
                .slice(last + 1)
                .some((part) => part.type === 'nesting')
            })
          },
        },
      })
      conditions.set(node.key.start, selector)
      if (local) localConditions.add(selector)
    } catch (error) {
      throw new Themes.InvalidError((error as Error).message, node)
    }
  }

  function importedHas(reference: Themes.Link): boolean {
    function contains(value: Themes.Link): boolean {
      return (
        value === reference || Object.values(value.members ?? {}).some(contains)
      )
    }
    return [...imported.values()].some(contains)
  }

  return { conditions, exports, identities, localConditions }
}
