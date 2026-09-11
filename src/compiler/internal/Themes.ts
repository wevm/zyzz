/**
 * Extracts local theme data and validates its lexical source references.
 * @module
 */
import type * as Ast from '@oxc-project/types'
import type * as Walker from 'oxc-walker'
import * as Config from '../../Config.js'
import * as Configurations from './Configurations.js'
import * as Token from '../../internal/Token.js'
import * as Theme from '../../Theme.js'
import type * as Source from '../Source.js'

/** Local bound-authoring initializer replaced while retaining its inferred type. */
export type Alias = Call & {
  /** Retains an immutable theme/configuration alias value with an explicit type. */
  readonly retained?: boolean | undefined
  /** Whether the initializer supplies a destructured css binding. */
  readonly destructured: boolean
}

/** Theme factory span and generated scope key. */
export type Call = {
  /** Whether the compiled configuration supplies initialization. */
  readonly script?: boolean | undefined
  /** Bound root initialization script export. */
  readonly initialization?: boolean | undefined
  /** Config helper represented by this linked binding. */
  readonly selection?: boolean | undefined
  /** Validated inline configuration options retained for packed declarations. */
  readonly options?: Readonly<Record<string, unknown>> | undefined
  /** JSON-encoded member path tuples and their compiled scope keys. */
  readonly members?: Readonly<Record<string, string>> | undefined
  /** Complete authoring type retained for configuration declarations. */
  readonly type?: string | undefined
  /** Exclusive source offset. */
  readonly end: number
  /** Stable module/binding scope key. */
  readonly name: string
  /** Inclusive source offset. */
  readonly start: number
  /** Literal token contract retained in rewritten TypeScript type assertions. */
  readonly tokenType: string
}

/** Internal context passed between graph extraction and module rewriting. */
export const context = Symbol('zyzz.source.graph')

/** Resolved authoring contract within a supplied source graph. */
export type Link = {
  readonly binding: string
  readonly call: Call
  readonly definition: Theme.Definition
  readonly kind: 'config' | 'css' | 'theme'
  readonly members?: Readonly<Record<string, Link>> | undefined
}

/** Shared graph data; no filesystem or runtime evaluation is involved. */
export type Context = {
  readonly extracted?: Source.extract.ReturnType | undefined
  readonly links: Readonly<Record<string, Link>>
  readonly owners?:
    | Readonly<Record<string, { call: Call; moduleId: string; source: string }>>
    | undefined
}

/** Collects immutable module-level themes without evaluating source. */
export function collect(program: Ast.Program, options: collect.Options) {
  const aliases: Alias[] = []
  const aliasBindings = new Map<number, Alias>()
  const aliasReferences = new Set<number>()
  const calls: Call[] = []
  const scripts = new Set<string>()
  const definitions = new Map<number, Call>()
  const factories = new Set<number>()
  const imports = new Set<number>()
  const configImports = new Set<number>()
  const configs = new Map<string, Link>()
  const configBindings = new Map<number, Link>()
  const factoryReferences = new Set<number>()
  const references: Reference[] = []
  const styles = new Map<
    number,
    {
      call: Ast.CallExpression
      output?: 'html' | undefined
      theme: Theme.Definition
    }
  >()
  const themes: Record<string, Theme.Definition> = Object.create(null)
  const tokens = new Map<number, { end: number; reference: Token.Reference }>()

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
      else if (
        specifier.type === 'ImportSpecifier' &&
        specifier.importKind !== 'type' &&
        (specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value) === 'Config'
      )
        configImports.add(specifier.start)
  }
  if (
    !imports.size &&
    !configImports.size &&
    !Object.keys(options.links ?? {}).length
  )
    return undefined

  const names = new Map<string, Call>()
  const aliasNames = new Map<string, Alias>()
  const exports: Record<string, Link> = Object.create(null)
  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration' || node.importKind === 'type')
      continue
    for (const specifier of node.specifiers) {
      const link = options.links?.[specifier.local.name]
      if (!link) continue
      const call = { ...link.call, start: -1, end: -1 }
      themes[call.name] = link.definition
      if (link.kind === 'config') {
        const imported = {
          ...link,
          call,
          members: Object.fromEntries(
            Object.entries(link.members ?? {}).map(([key, member]) => [
              key,
              { ...member, call: { ...member.call, start: -1, end: -1 } },
            ]),
          ),
        }
        configs.set(specifier.local.name, imported)
        configBindings.set(specifier.start, imported)
        for (const member of Object.values(link.members ?? {}))
          themes[member.call.name] = member.definition
      } else if (link.kind === 'theme') {
        definitions.set(specifier.start, call)
        names.set(specifier.local.name, call)
      } else {
        const alias = { ...call, destructured: false }
        aliasBindings.set(specifier.start, alias)
        aliasNames.set(specifier.local.name, alias)
      }
    }
  }
  const namespaces = new Set<string>()
  const configNamespaces = new Set<string>()
  for (const node of program.body)
    if (node.type === 'ImportDeclaration')
      for (const specifier of node.specifiers)
        if (imports.has(specifier.start)) namespaces.add(specifier.local.name)
        else if (configImports.has(specifier.start))
          configNamespaces.add(specifier.local.name)

  function resolve(node: Ast.Node): Link | undefined {
    if (node.type === 'Identifier') {
      const config = configs.get(node.name)
      if (config) return config
      const call = names.get(node.name)
      if (call)
        return {
          binding: call.name,
          call,
          definition: themes[call.name]!,
          kind: 'theme',
        }
      return undefined
    }
    if (node.type !== 'MemberExpression' || node.optional) return undefined
    const path: string[] = []
    let root: Ast.Node = node
    while (root.type === 'MemberExpression') {
      const key = (() => {
        if (root.property.type === 'Identifier' && !root.computed) {
          return root.property.name
        }
        if (
          root.property.type === 'Literal' &&
          root.computed &&
          (typeof root.property.value === 'string' ||
            typeof root.property.value === 'number')
        ) {
          return String(root.property.value)
        }
        return undefined
      })()
      if (root.optional || key === undefined) return undefined
      path.unshift(key)
      root = root.object
    }
    return root.type === 'Identifier'
      ? configs.get(root.name)?.members?.[JSON.stringify(path)]
      : undefined
  }

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
    if (node.type === 'ArrayExpression')
      return node.elements.map((element) => {
        if (!element || element.type === 'SpreadElement')
          return fail('Theme arrays require dense literal elements.', node)
        return data(element)
      })
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
      const key = (() => {
        if (property.key.type === 'Identifier') {
          return property.key.name
        }
        if (
          property.key.type === 'Literal' &&
          (typeof property.key.value === 'string' ||
            typeof property.key.value === 'number')
        ) {
          return String(property.key.value)
        }
        return undefined
      })()
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
        const key = (() => {
          if (property.key.type === 'Identifier') {
            return JSON.stringify(property.key.name)
          }
          if (property.key.type === 'Literal') {
            return JSON.stringify(property.key.value)
          }
          return fail('Expected a literal theme key.', property.key)
        })()
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
      registerAlias({ declaration, statement, variable })
      const expression = variable.init
      if (
        expression?.type !== 'CallExpression' ||
        expression.callee.type !== 'MemberExpression' ||
        expression.callee.object.type !== 'Identifier' ||
        (!namespaces.has(expression.callee.object.name) &&
          !configNamespaces.has(expression.callee.object.name))
      )
        continue
      const member = expression.callee
      if (
        member.computed ||
        member.optional ||
        expression.optional ||
        member.property.type !== 'Identifier' ||
        !(
          configNamespaces.has(expression.callee.object.name)
            ? ['create']
            : ['define', 'extend']
        ).includes(member.property.name)
      )
        continue
      if (
        (statement.type === 'ExportNamedDeclaration' && !options.linked) ||
        declaration.kind !== 'const' ||
        (variable.id.type !== 'Identifier' &&
          !(
            configNamespaces.has(expression.callee.object.name) &&
            variable.id.type === 'ObjectPattern'
          ))
      )
        fail(
          'Define local themes with a module-level const; exported themes require source linking.',
          variable,
        )
      const bindings = (() => {
        if (variable.id.type !== 'ObjectPattern') return []
        return variable.id.properties.map((property) => {
          if (
            property.type !== 'Property' ||
            property.computed ||
            property.key.type !== 'Identifier' ||
            property.value.type !== 'Identifier'
          )
            fail(
              'Configuration destructuring requires named bindings without defaults, rest, or nested patterns.',
              property,
            )
          return { key: property.key.name, id: property.value }
        })
      })()
      const binding =
        variable.id.type === 'Identifier'
          ? variable.id.name
          : bindings[0]?.id.name
      if (!binding)
        fail('Configuration destructuring requires a binding.', variable)
      const name = `${options.namespace}-${binding}`
      if (configNamespaces.has(expression.callee.object.name)) {
        try {
          const link = Configurations.collect({
            data,
            expression,
            name,
            resolve: (node) => {
              const link = resolve(node)
              if (link) factoryReferences.add(node.start)
              return link
            },
          })
          if (variable.id.type === 'Identifier') {
            configs.set(variable.id.name, link)
            configBindings.set(variable.id.start, link)
            if (statement.type === 'ExportNamedDeclaration')
              exports[variable.id.name] = link
          }
          calls.push(link.call)
          factories.add(expression.start)
          for (const member of Object.values(link.members ?? {}))
            themes[member.call.name] = member.definition
          themes[link.call.name] = link.definition
          for (const { key, id } of bindings) {
            if (key === 'css') {
              const alias = { ...link.call, destructured: false }
              aliasBindings.set(id.start, alias)
              aliasNames.set(id.name, alias)
              if (statement.type === 'ExportNamedDeclaration')
                exports[id.name] = {
                  ...link,
                  binding: `${options.namespace}-${id.name}`,
                  kind: 'css',
                }
              continue
            }
            if (
              key === 'script' ||
              (key === 'themes' && link.call.options?.themes)
            ) {
              if (key === 'script') scripts.add(link.call.name)
              const members = Object.fromEntries(
                Object.entries(link.members ?? {}).flatMap(
                  ([pathKey, member]) => {
                    const path = JSON.parse(pathKey) as string[]
                    return key === 'themes' && path[0] === 'themes'
                      ? [[JSON.stringify(path.slice(1)), member]]
                      : []
                  },
                ),
              )
              const selection = {
                ...link,
                members,
                call: {
                  ...link.call,
                  members: Object.fromEntries(
                    Object.entries(members).map(([key, member]) => [
                      key,
                      member.call.name,
                    ]),
                  ),
                  ...(key === 'script'
                    ? { initialization: true }
                    : { selection: true }),
                  type: `${link.call.type}['${key}']`,
                },
              }
              configs.set(id.name, selection)
              configBindings.set(id.start, selection)
              if (statement.type === 'ExportNamedDeclaration')
                exports[id.name] = selection
              continue
            }
            const member = link.members?.[JSON.stringify([key])]
            if (!member)
              fail(
                'Destructure only css and the configured single theme; other helpers remain unsupported.',
                id,
              )
            definitions.set(id.start, member.call)
            names.set(id.name, member.call)
            if (statement.type === 'ExportNamedDeclaration')
              exports[id.name] = member
          }
        } catch (error) {
          if (!(error instanceof Config.InvalidError)) throw error
          fail(error.message, expression)
        }
        continue
      }
      let definition: Theme.Definition
      let tokenType: string
      try {
        if (member.property.name === 'define') {
          if (expression.arguments.length !== 1)
            fail('Theme.define requires one literal token object.', expression)
          const input = data(expression.arguments[0]!)
          tokenType = type(expression.arguments[0]!)
          const original = Theme.define(input as Theme.Tokens)
          definition = Token.bind(
            original,
            Object.freeze({ [Token.identity]: name }),
          )
        } else {
          const base = expression.arguments[0]
          const parent = base ? resolve(base)?.call : undefined
          if (expression.arguments.length !== 2 || !parent)
            fail(
              'Theme.extend requires a preceding local theme and literal overrides.',
              expression,
            )
          factoryReferences.add(base!.start)
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
        ...(definition[Token.definition].contract.shorthands
          ? {
              type: `import('zyzz').Config.create.ReturnType<{theme:${tokenType};shorthands:${Configurations.type(definition[Token.definition].contract.shorthands!)}}>['theme']`,
            }
          : {}),
      })
      calls.push(call)
      definitions.set(variable.id.start, call)
      factories.add(expression.start)
      names.set(binding, call)
      themes[name] = definition
      if (statement.type === 'ExportNamedDeclaration')
        exports[binding] = {
          binding: name,
          call,
          definition,
          kind: 'theme',
        }
    }
  }

  function registerAlias(input: {
    declaration: Ast.VariableDeclaration
    statement: Ast.Node
    variable: Ast.VariableDeclarator
  }) {
    const { declaration, statement, variable } = input
    const expression = variable.init
    if (!expression) return
    const linked = resolve(expression)
    if (linked && variable.id.type === 'Identifier') {
      if (expression.start < linked.call.end)
        fail('Authoring aliases must follow their definition.', expression)
      if (
        declaration.kind !== 'const' ||
        (statement.type === 'ExportNamedDeclaration' && !options.linked)
      )
        fail('Authoring aliases require module-level const bindings.', variable)
      if (linked.kind === 'config') {
        configs.set(variable.id.name, linked)
        configBindings.set(variable.id.start, linked)
      } else {
        names.set(variable.id.name, linked.call)
        definitions.set(variable.id.start, linked.call)
      }
      aliases.push({
        ...linked.call,
        start: expression.start,
        end: expression.end,
        destructured: false,
        retained: true,
      })
      aliasReferences.add(expression.start)
      if (statement.type === 'ExportNamedDeclaration')
        exports[variable.id.name] = linked
      return
    }
    const member = (() => {
      if (
        expression.type === 'MemberExpression' &&
        !expression.computed &&
        !expression.optional &&
        expression.property.type === 'Identifier' &&
        expression.property.name === 'css'
      ) {
        return expression.object
      }
      return undefined
    })()
    const destructured =
      variable.id.type === 'ObjectPattern' && expression.type === 'Identifier'
    const source =
      member ?? (expression.type === 'Identifier' ? expression : undefined)
    if (!source) return
    const theme = (() => {
      if (member || destructured) {
        return resolve(source)?.call
      }
      if (source.type === 'Identifier') {
        return aliasNames.get(source.name)
      }
      return undefined
    })()
    if (!theme) return
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
      (statement.type === 'ExportNamedDeclaration' && !options.linked) ||
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
      type: theme.type,
      options: theme.options,
    })
    aliases.push(alias)
    aliasBindings.set(id.start, alias)
    aliasNames.set(id.name, alias)
    aliasReferences.add(source.start)
    if (statement.type === 'ExportNamedDeclaration')
      exports[id.name] = {
        binding: `${options.namespace}-${id.name}`,
        call: alias,
        definition: themes[alias.name]!,
        kind: 'css',
      }
  }

  const exportReferences = new Set<number>()
  if (options.linked)
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
        const call =
          configs.get(name)?.call ?? names.get(name) ?? aliasNames.get(name)
        if (!call) continue
        const exported =
          specifier.exported.type === 'Identifier'
            ? specifier.exported.name
            : specifier.exported.value
        exports[exported] = configs.get(name) ??
          options.links?.[name] ?? {
            binding: `${options.namespace}-${name}`,
            call,
            definition: themes[call.name]!,
            kind: names.has(name) ? 'theme' : 'css',
          }
        exportReferences.add(specifier.local.start)
      }
    }

  function reference(
    node: Extract<Ast.Node, { type: 'Identifier' | 'JSXIdentifier' }>,
    parent: Ast.Node,
    ancestors: readonly Ast.Node[],
    binding: Walker.ScopeTrackerNode | null,
  ): boolean {
    const grandparent = ancestors.at(-3)
    if (
      binding?.type === 'Import' &&
      (imports.has(binding.node.start) || configImports.has(binding.node.start))
    ) {
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
      binding?.type === 'Variable' || binding?.type === 'Import'
        ? aliasBindings.get(binding.node.start)
        : undefined
    if (alias) {
      if (
        node.start === binding!.node.start ||
        exportReferences.has(node.start)
      )
        return true
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
      styles.set(parent.start, {
        call: parent,
        theme: themes[alias.name]!,
        output: alias.options?.output === 'html' ? 'html' : undefined,
      })
      return true
    }
    const config =
      binding?.type === 'Variable' || binding?.type === 'Import'
        ? configBindings.get(binding.node.start)
        : undefined
    if (config) {
      if (node.start === binding!.node.start) return true
      if (exportReferences.has(node.start) || aliasReferences.has(node.start))
        return true
      if (
        node.start < config.call.end &&
        config.call.start >= 0 &&
        binding?.type !== 'Import'
      )
        fail('Configuration references must follow their definition.', node)
      if (
        (config.call.selection || config.call.initialization) &&
        parent.type === 'CallExpression' &&
        parent.callee === node &&
        !parent.optional
      )
        return true
      let target: Ast.Node = node
      const path: string[] = []
      for (let index = ancestors.length - 2; index >= 0; index--) {
        const member = ancestors[index]!
        if (
          member.type !== 'MemberExpression' ||
          member.object !== target ||
          member.optional
        )
          break
        const key = (() => {
          if (member.property.type === 'Identifier' && !member.computed) {
            return member.property.name
          }
          if (
            member.property.type === 'Literal' &&
            member.computed &&
            (typeof member.property.value === 'string' ||
              typeof member.property.value === 'number')
          ) {
            return String(member.property.value)
          }
          return undefined
        })()
        if (key === undefined) break
        path.push(key)
        target = member
        if (
          aliasReferences.has(target.start) ||
          factoryReferences.has(target.start)
        )
          return true
        if (
          path.length === 1 &&
          !config.call.selection &&
          !config.call.initialization &&
          ['script', 'themes'].includes(path[0]!) &&
          ancestors[index - 1]?.type === 'CallExpression' &&
          (ancestors[index - 1] as Ast.CallExpression).callee === target &&
          !(ancestors[index - 1] as Ast.CallExpression).optional
        ) {
          if (path[0] === 'script') {
            if (!config.call.script)
              fail(
                'This packed configuration does not provide script(); rebuild its library with initialization support.',
                target,
              )
            scripts.add(config.call.name)
          }
          return true
        }
        if (path.length === 1 && path[0] === 'css') {
          const call = ancestors[index - 1]
          if (
            call?.type !== 'CallExpression' ||
            call.callee !== target ||
            call.optional
          )
            break
          styles.set(call.start, {
            call,
            theme: config.definition,
            output: config.call.options?.output === 'html' ? 'html' : undefined,
          })
          return true
        }
        const linked = config.members?.[JSON.stringify(path)]
        if (linked)
          return themeReference(
            target,
            ancestors[index - 1]!,
            ancestors.slice(0, index + 1),
            linked.call,
          )
      }
      fail(
        'Use direct configuration css calls or static theme members; configurations cannot escape or be mutated.',
        node,
      )
    }
    const theme =
      binding?.type === 'Variable' || binding?.type === 'Import'
        ? definitions.get(binding.node.start)
        : undefined
    if (!theme) return false
    if (node.start === binding!.node.start) return true
    return themeReference(node, parent, ancestors, theme)
  }

  function themeReference(
    node: Ast.Node,
    parent: Ast.Node,
    ancestors: readonly Ast.Node[],
    theme: Call,
  ): boolean {
    const grandparent = ancestors.at(-3)
    if (factoryReferences.has(node.start)) return true
    if (exportReferences.has(node.start)) return true
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
      parent.type === 'MemberExpression' &&
      parent.object === node &&
      ((parent.property.type === 'Identifier' &&
        !parent.computed &&
        ['tokens', 'vars'].includes(parent.property.name)) ||
        (parent.property.type === 'Literal' &&
          parent.computed &&
          ['tokens', 'vars'].includes(String(parent.property.value))))
    ) {
      if (parent.optional)
        fail('Token references cannot use optional access.', parent)
      const variable =
        parent.property.type === 'Identifier'
          ? parent.property.name === 'vars'
          : parent.property.type === 'Literal' &&
            parent.property.value === 'vars'
      let value: unknown = variable
        ? themes[theme.name]!.vars
        : themes[theme.name]!.tokens
      let target: Ast.Node = parent
      let index = ancestors.length - 3
      for (; index >= 0; index--) {
        const ancestor = ancestors[index]!
        if (ancestor.type !== 'MemberExpression' || ancestor.object !== target)
          break
        const key = (() => {
          if (ancestor.property.type === 'Identifier' && !ancestor.computed) {
            return ancestor.property.name
          }
          if (
            ancestor.property.type === 'Literal' &&
            ancestor.computed &&
            (typeof ancestor.property.value === 'string' ||
              typeof ancestor.property.value === 'number')
          ) {
            return String(ancestor.property.value)
          }
          return undefined
        })()
        if (ancestor.optional || key === undefined)
          fail(
            'Token paths require static property names without optional access.',
            ancestor,
          )
        value =
          value && typeof value === 'object' && !Token.is(value)
            ? Object.getOwnPropertyDescriptor(value, key)?.value
            : undefined
        if (value === undefined) fail('Unknown theme token path.', ancestor)
        target = ancestor
      }
      if (!Token.is(value))
        fail('Expected a scalar theme token reference.', target)
      const reference = value
      for (; index >= 0; index--) {
        const ancestor = ancestors[index]!
        if (
          (ancestor.type === 'TSAsExpression' ||
            ancestor.type === 'TSSatisfiesExpression' ||
            ancestor.type === 'TSNonNullExpression' ||
            ancestor.type === 'TSTypeAssertion') &&
          ancestor.expression === target
        )
          target = ancestor
        else break
      }
      const valueTarget = target
      if (variable) {
        while (index >= 0) {
          const ancestor = ancestors[index]!
          if (
            !(
              (ancestor.type === 'TemplateLiteral' &&
                ancestor.expressions.includes(target as Ast.Expression)) ||
              ((ancestor.type === 'TSAsExpression' ||
                ancestor.type === 'TSSatisfiesExpression' ||
                ancestor.type === 'TSNonNullExpression' ||
                ancestor.type === 'TSTypeAssertion') &&
                ancestor.expression === target)
            )
          )
            break
          target = ancestor
          index--
        }
      }
      const array = ancestors[index]
      if (
        array?.type === 'ArrayExpression' &&
        array.elements.includes(target as Ast.Expression)
      ) {
        target = array
        index--
        for (; index >= 0; index--) {
          const ancestor = ancestors[index]!
          if (
            (ancestor.type === 'TSAsExpression' ||
              ancestor.type === 'TSSatisfiesExpression' ||
              ancestor.type === 'TSNonNullExpression' ||
              ancestor.type === 'TSTypeAssertion') &&
            ancestor.expression === target
          )
            target = ancestor
          else break
        }
      }
      const property = ancestors[index]
      const object = ancestors[index - 1]
      let argument: Ast.Node | undefined = object
      let callIndex = index - 2
      for (; callIndex >= 0; callIndex--) {
        const ancestor = ancestors[callIndex]!
        if (
          ancestor.type === 'Property' &&
          ancestor.value === argument &&
          ancestors[callIndex - 1]?.type === 'ObjectExpression'
        ) {
          argument = ancestors[--callIndex]
          continue
        }
        if (
          (ancestor.type === 'TSAsExpression' ||
            ancestor.type === 'TSSatisfiesExpression' ||
            ancestor.type === 'TSNonNullExpression' ||
            ancestor.type === 'TSTypeAssertion') &&
          ancestor.expression === argument
        )
          argument = ancestor
        else break
      }
      if (
        ancestors[callIndex]?.type === 'ArrowFunctionExpression' &&
        (ancestors[callIndex] as Ast.ArrowFunctionExpression).body === argument
      ) {
        argument = ancestors[callIndex]
        callIndex--
      }
      while (callIndex >= 0) {
        const wrapper = ancestors[callIndex]!
        if (
          (wrapper.type === 'TSAsExpression' ||
            wrapper.type === 'TSSatisfiesExpression' ||
            wrapper.type === 'TSNonNullExpression' ||
            wrapper.type === 'TSTypeAssertion') &&
          wrapper.expression === argument
        ) {
          argument = wrapper
          callIndex--
        } else break
      }
      const call = ancestors[callIndex]
      if (
        property?.type !== 'Property' ||
        property.value !== target ||
        object?.type !== 'ObjectExpression' ||
        call?.type !== 'CallExpression' ||
        call.arguments[0] !== argument ||
        (!styles.has(call.start) && !options.contributionCalls?.has(call.start))
      )
        fail(
          'Token references must be direct property values in bound theme css calls.',
          target,
        )
      tokens.set(valueTarget.start, { end: valueTarget.end, reference })
      return true
    }
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

  for (const link of Object.values(exports))
    if (
      link.kind === 'config' &&
      !link.call.selection &&
      !link.call.initialization &&
      link.call.script
    )
      scripts.add(link.call.name)

  return {
    aliases,
    calls,
    exports: Object.freeze(exports),
    reference,
    references,
    scripts,
    styles,
    themes: Object.freeze(themes),
    tokens,
  }
}

/** Inputs supplied by the source adapter. */
export declare namespace collect {
  /** Stable module namespace, independent of token values and call offsets. */
  type Options = {
    /** Encoded package/module identity from the source adapter. */
    readonly contributionCalls?: ReadonlySet<number> | undefined
    readonly namespace: string
    readonly linked?: boolean | undefined
    readonly links?: Readonly<Record<string, Link>> | undefined
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
