/**
 * Extracts local theme data and validates its lexical source references.
 * @module
 */
import type * as Ast from '@oxc-project/types'
import type * as Walker from 'oxc-walker'
import * as Token from '../../internal/Token.js'
import * as Theme from '../../Theme.js'

/** Local bound-authoring initializer replaced while retaining its inferred type. */
export type Alias = Call & {
  /** Whether the initializer supplies a destructured css binding. */
  readonly destructured: boolean
}

/** Theme factory span and generated scope key. */
export type Call = {
  /** Exclusive source offset. */
  readonly end: number
  /** Stable module/binding scope key. */
  readonly name: string
  /** Inclusive source offset. */
  readonly start: number
  /** Literal token contract retained in rewritten TypeScript type assertions. */
  readonly tokenType: string
}

/** Collects immutable module-level themes without evaluating source. */
export function collect(program: Ast.Program, options: collect.Options) {
  const aliases: Alias[] = []
  const aliasBindings = new Map<number, Alias>()
  const aliasReferences = new Set<number>()
  const calls: Call[] = []
  const definitions = new Map<number, Call>()
  const factories = new Set<number>()
  const imports = new Set<number>()
  const references: Reference[] = []
  const styles = new Map<
    number,
    { call: Ast.CallExpression; theme: Theme.Definition }
  >()
  const themes: Record<string, Theme.Definition> = Object.create(null)

  for (const node of program.body) {
    if (
      node.type !== 'ImportDeclaration' ||
      node.source.value !== 'zyzz' ||
      node.importKind === 'type'
    )
      continue
    for (const specifier of node.specifiers)
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.importKind !== 'type' &&
        (specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value) === 'Theme'
      )
        imports.add(specifier.start)
  }
  if (!imports.size) return undefined

  const names = new Map<string, Call>()
  const namespaces = new Set<string>()
  for (const node of program.body)
    if (node.type === 'ImportDeclaration')
      for (const specifier of node.specifiers)
        if (imports.has(specifier.start)) namespaces.add(specifier.local.name)

  function data(node: Ast.Node): unknown {
    if (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression')
      return data(node.expression)
    if (
      node.type === 'Literal' &&
      (typeof node.value === 'string' || typeof node.value === 'number')
    )
      return node.value
    if (
      node.type === 'UnaryExpression' &&
      (node.operator === '+' || node.operator === '-') &&
      node.argument.type === 'Literal' &&
      typeof node.argument.value === 'number'
    )
      return node.operator === '-' ? -node.argument.value : node.argument.value
    if (node.type !== 'ObjectExpression')
      return fail(
        'Theme values must be literal data; expressions are not evaluated.',
        node,
      )
    const result: Record<string, unknown> = Object.create(null)
    for (const property of node.properties) {
      if (
        property.type !== 'Property' ||
        property.computed ||
        property.method ||
        property.shorthand ||
        property.kind !== 'init'
      )
        return fail(
          'Theme data requires explicit properties without spreads, methods, or computed keys.',
          property,
        )
      const key =
        property.key.type === 'Identifier'
          ? property.key.name
          : property.key.type === 'Literal' &&
              (typeof property.key.value === 'string' ||
                typeof property.key.value === 'number')
            ? String(property.key.value)
            : undefined
      if (key === undefined || Object.hasOwn(result, key))
        return fail('Theme data requires unique literal keys.', property)
      result[key] = data(property.value)
    }
    return result
  }

  function fail(message: string, node: Pick<Ast.Node, 'end' | 'start'>): never {
    throw new InvalidError(message, node)
  }

  function type(node: Ast.Node): string {
    if (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression')
      return type(node.expression)
    if (node.type !== 'ObjectExpression') return JSON.stringify(data(node))
    return `{${node.properties
      .map((property) => {
        if (property.type !== 'Property')
          return fail('Expected validated theme properties.', property)
        const key =
          property.key.type === 'Identifier'
            ? JSON.stringify(property.key.name)
            : property.key.type === 'Literal'
              ? JSON.stringify(property.key.value)
              : fail('Expected a literal theme key.', property.key)
        return `readonly ${key}:${type(property.value)}`
      })
      .join(';')}}`
  }

  for (const statement of program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement
    if (declaration?.type !== 'VariableDeclaration') continue
    for (const variable of declaration.declarations) {
      const expression = variable.init
      if (
        expression?.type !== 'CallExpression' ||
        expression.callee.type !== 'MemberExpression' ||
        expression.callee.object.type !== 'Identifier' ||
        !namespaces.has(expression.callee.object.name)
      )
        continue
      const member = expression.callee
      if (
        member.computed ||
        member.optional ||
        expression.optional ||
        member.property.type !== 'Identifier' ||
        !['define', 'extend'].includes(member.property.name)
      )
        continue
      if (
        statement.type === 'ExportNamedDeclaration' ||
        declaration.kind !== 'const' ||
        variable.id.type !== 'Identifier'
      )
        fail(
          'Define local themes with a module-level const; exported themes require source linking.',
          variable,
        )
      const name = `${options.namespace}-${variable.id.name}`
      let definition: Theme.Definition
      let tokenType: string
      try {
        if (member.property.name === 'define') {
          if (expression.arguments.length !== 1)
            fail('Theme.define requires one literal token object.', expression)
          const input = data(expression.arguments[0]!)
          tokenType = type(expression.arguments[0]!)
          const original = Theme.define(input as Theme.Tokens)
          const contract = Object.freeze({ [Token.identity]: name })
          type Tree = { [key: string]: Token.Reference | Tree }
          function rebind(tree: Theme.References<Theme.Tokens>): Tree {
            return Object.freeze(
              Object.fromEntries(
                Object.entries(tree).map(([key, value]) => [
                  key,
                  Token.is(value)
                    ? Token.create({
                        contract,
                        group: value.group,
                        path: value.path,
                        value: value.value,
                      })
                    : rebind(value as Theme.References<Theme.Tokens>),
                ]),
              ),
            )
          }
          definition = Object.freeze(
            Object.defineProperty(
              {
                get className() {
                  return original.className
                },
                css: original.css,
                tokens: rebind(original.tokens),
              },
              Token.definition,
              {
                value: Object.freeze({
                  ...original[Token.definition],
                  contract,
                }),
              },
            ),
          ) as Theme.Definition
        } else {
          const base = expression.arguments[0]
          const parent =
            base?.type === 'Identifier' ? names.get(base.name) : undefined
          if (expression.arguments.length !== 2 || !parent)
            fail(
              'Theme.extend requires a preceding local theme and literal overrides.',
              expression,
            )
          definition = Theme.extend(
            themes[parent.name]!,
            data(expression.arguments[1]!) as Theme.Overrides<Theme.Tokens>,
          )
          tokenType = parent.tokenType
        }
      } catch (error) {
        if (error instanceof InvalidError) throw error
        if (!(error instanceof Theme.InvalidError)) throw error
        fail(error.message, expression)
      }
      const call = Object.freeze({
        end: expression.end,
        name,
        start: expression.start,
        tokenType,
      })
      calls.push(call)
      definitions.set(variable.id.start, call)
      factories.add(expression.start)
      names.set(variable.id.name, call)
      themes[name] = definition
    }
  }

  const aliasNames = new Map<string, Alias>()
  for (const statement of program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement
    if (declaration?.type !== 'VariableDeclaration') continue
    for (const variable of declaration.declarations) {
      const expression = variable.init
      if (!expression) continue
      const member =
        expression.type === 'MemberExpression' &&
        !expression.computed &&
        !expression.optional &&
        expression.property.type === 'Identifier' &&
        expression.property.name === 'css' &&
        expression.object.type === 'Identifier'
          ? expression.object
          : undefined
      const destructured =
        variable.id.type === 'ObjectPattern' && expression.type === 'Identifier'
      const source =
        member ?? (expression.type === 'Identifier' ? expression : undefined)
      if (!source) continue
      const theme =
        member || destructured
          ? names.get(source.name)
          : aliasNames.get(source.name)
      if (!theme) continue
      let id = variable.id
      if (destructured && id.type === 'ObjectPattern') {
        const property = id.properties[0]
        if (
          id.properties.length !== 1 ||
          property?.type !== 'Property' ||
          property.computed ||
          property.key.type !== 'Identifier' ||
          property.key.name !== 'css' ||
          property.value.type !== 'Identifier'
        )
          fail(
            'Destructure only css into a const binding without defaults or rest properties.',
            id,
          )
        id = property.value
      }
      if (
        declaration.kind !== 'const' ||
        statement.type === 'ExportNamedDeclaration' ||
        id.type !== 'Identifier'
      )
        fail(
          'Theme css aliases require a local module-level const binding.',
          variable,
        )
      if (expression.start < theme.end)
        fail('Theme css aliases must follow their definition.', expression)
      const alias = Object.freeze({
        destructured,
        end: expression.end,
        name: theme.name,
        start: expression.start,
        tokenType: theme.tokenType,
      })
      aliases.push(alias)
      aliasBindings.set(id.start, alias)
      aliasNames.set(id.name, alias)
      aliasReferences.add(source.start)
    }
  }

  function reference(
    node: Extract<Ast.Node, { type: 'Identifier' | 'JSXIdentifier' }>,
    parent: Ast.Node,
    ancestors: readonly Ast.Node[],
    binding: Walker.ScopeTrackerNode | null,
  ): boolean {
    const grandparent = ancestors.at(-3)
    if (binding?.type === 'Import' && imports.has(binding.node.start)) {
      if (
        parent.type === 'MemberExpression' &&
        grandparent?.type === 'CallExpression' &&
        factories.has(grandparent.start)
      )
        return true
      fail(
        'Theme factories require direct module-level const declarations; aliases and indirect references require source linking.',
        node,
      )
    }
    const alias =
      binding?.type === 'Variable'
        ? aliasBindings.get(binding.node.start)
        : undefined
    if (alias) {
      if (node.start === binding!.node.start) return true
      if (node.start < alias.end)
        fail('Theme css alias references must follow their definition.', node)
      if (aliasReferences.has(node.start)) return true
      if (
        parent.type !== 'CallExpression' ||
        parent.callee !== node ||
        parent.optional
      )
        fail(
          'Theme css aliases support direct calls only; exporting or escaping them requires source linking.',
          node,
        )
      styles.set(parent.start, { call: parent, theme: themes[alias.name]! })
      return true
    }
    const theme =
      binding?.type === 'Variable'
        ? definitions.get(binding.node.start)
        : undefined
    if (!theme) return false
    if (aliasReferences.has(node.start)) return true
    if (node.start < theme.end)
      fail('Theme references must follow their local definition.', node)
    if (
      parent.type === 'CallExpression' &&
      factories.has(parent.start) &&
      parent.arguments[0] === node
    )
      return true
    if (
      parent.type !== 'MemberExpression' ||
      parent.object !== node ||
      parent.computed ||
      parent.optional ||
      parent.property.type !== 'Identifier'
    )
      fail(
        'Use local theme.css calls, theme.className reads, or Theme.extend; other theme references require source linking.',
        node,
      )
    if (
      parent.property.name === 'css' &&
      grandparent?.type === 'CallExpression' &&
      grandparent.callee === parent &&
      !grandparent.optional
    ) {
      styles.set(grandparent.start, {
        call: grandparent,
        theme: themes[theme.name]!,
      })
      return true
    }
    if (parent.property.name !== 'className')
      fail(
        'Only direct theme.css calls and theme.className reads are supported here.',
        parent,
      )
    let target: Ast.Node = parent
    for (let index = ancestors.length - 3; index >= 0; index--) {
      const ancestor = ancestors[index]!
      if (
        (ancestor.type === 'AssignmentExpression' &&
          ancestor.left === target) ||
        (ancestor.type === 'UpdateExpression' &&
          ancestor.argument === target) ||
        (ancestor.type === 'UnaryExpression' &&
          ancestor.operator === 'delete') ||
        ((ancestor.type === 'ForInStatement' ||
          ancestor.type === 'ForOfStatement') &&
          ancestor.left === target)
      )
        fail('Theme scope properties cannot be reassigned.', ancestor)
      if (
        ((ancestor.type === 'TSAsExpression' ||
          ancestor.type === 'TSNonNullExpression' ||
          ancestor.type === 'TSSatisfiesExpression' ||
          ancestor.type === 'TSTypeAssertion') &&
          ancestor.expression === target) ||
        (ancestor.type === 'Property' && ancestor.value === target) ||
        ancestor.type === 'ObjectPattern' ||
        ancestor.type === 'ArrayPattern' ||
        (ancestor.type === 'RestElement' && ancestor.argument === target) ||
        (ancestor.type === 'AssignmentPattern' && ancestor.left === target)
      )
        target = ancestor
      else break
    }
    references.push(
      Object.freeze({ end: parent.end, name: theme.name, start: parent.start }),
    )
    return true
  }

  return {
    aliases,
    calls,
    reference,
    references,
    styles,
    themes: Object.freeze(themes),
  }
}

/** Inputs supplied by the source adapter. */
export declare namespace collect {
  /** Stable module namespace, independent of token values and call offsets. */
  type Options = {
    /** Encoded package/module identity from the source adapter. */
    readonly namespace: string
  }
}

/** Located failure from unsupported or invalid local theme syntax. */
export class InvalidError extends Error {
  /** Retains a source span for the public extractor diagnostic. */
  constructor(message: string, node: Pick<Ast.Node, 'end' | 'start'>) {
    super(message)
    this.end = node.end
    this.start = node.start
  }
  /** Exclusive source offset. */
  readonly end: number
  /** Namespaced diagnostic identity. */
  override name = 'Source.ThemeInvalidError'
  /** Inclusive source offset. */
  readonly start: number
}

/** Scope property read replaced with a compiled constant. */
export type Reference = Pick<Call, 'end' | 'name' | 'start'>
