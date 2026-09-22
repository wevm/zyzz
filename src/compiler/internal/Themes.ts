/**
 * Extracts local theme data and validates its lexical source references.
 * @module
 */
import type * as Syntax from './Syntax.js'
import * as Identity from '../../internal/Identity.js'
import * as Identifiers from './Identifiers.js'
import type { cssFunction } from '../../web/cssFunction.js'
import type * as RuleReference from '../../internal/RuleReference.js'
import type * as Ast from '@oxc-project/types'
import type * as Walker from 'oxc-walker'
import type * as Binding from '../../internal/Binding.js'
import * as Config from '../../internal/Configuration.js'
import * as Expression from './Expression.js'
import * as Configurations from './Configurations.js'
import * as Token from '../../internal/Token.js'
import * as Theme from '../../internal/Theme.js'
import * as VariableSets from '../../internal/VariableSets.js'
import * as Vars from '../../Vars.js'
import type * as Source from '../Source.js'
import type * as PackedStyles from './PackedStyles.js'

/** Local bound-authoring initializer replaced while retaining its inferred type. */
export type Alias = Call & {
  /** Ordered authoring members replaced in a shared destructuring initializer. */
  readonly bindings?: readonly ('style' | 'variants')[] | undefined
  /** Whether the initializer supplies destructured authoring bindings. */
  readonly destructured: boolean
  /** Retains an immutable theme/configuration alias value with an explicit type. */
  readonly retained?: boolean | undefined
}

/** Theme factory span and generated scope key. */
export type Call = {
  readonly variableSet?: boolean | undefined
  readonly directVariables?: boolean | undefined
  readonly variableConfig?: boolean | undefined
  readonly variableMappings?: Vars.Mappings | false | undefined
  /** Whether this bound authoring alias declares recipes. */
  readonly recipe?: boolean | undefined
  /** Static CSS function signature shared during extraction and packed serialization. */
  readonly function?:
    | {
        parameters: readonly cssFunction.Parameter[]
        returns: cssFunction.Syntax
      }
    | undefined
  /** Named stylesheet identity domain. */
  readonly reference?: RuleReference.Kind | undefined
  /** Canonical defining module for multi-entry variable contracts. */
  readonly variableOwner?: string | undefined
  readonly output?: 'html' | undefined
  /** Portable explicit variable references. */
  readonly variables?: Readonly<Record<string, Binding.Reference>> | undefined
  /** Whether the compiled configuration supplies root controls. */
  readonly appearance?: boolean | undefined
  /** Whether the compiled configuration supplies initialization. */
  readonly script?: boolean | undefined
  /** Bound root initialization script export. */
  readonly initialization?: boolean | undefined
  /** Bound root controls export. */
  readonly root?: boolean | undefined
  /** Config helper represented by this linked binding. */
  readonly selection?: boolean | undefined
  /** Legacy packed catalogs have static members but are not callable. */
  /** Legacy packed catalog exposes members but lacks callable-selection capability. */
  readonly catalogOnly?: boolean | undefined
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
  /** Complete callable style and ownership data for cross-module composition. */
  readonly style?: PackedStyles.Definition | undefined
  readonly binding: string
  readonly call: Call
  readonly definition: Theme.Definition
  readonly kind:
    | 'config'
    | 'style'
    | 'theme'
    | 'style-reference'
    | 'animation'
    | 'rule-reference'
    | 'variables'
  readonly members?: Readonly<Record<string, Link>> | undefined
}

/** Shared graph data; no filesystem or runtime evaluation is involved. */
export type Context = {
  /** Canonical identifier names collected during graph validation. */
  readonly identifiers?: ReadonlySet<string> | undefined
  /** Syntax owned by the current graph compilation. */
  readonly parsed?: ReturnType<typeof Syntax.parse> | undefined
  /** Packed exports indexed by the importing module's source specifier. */
  readonly libraries?:
    | Readonly<Record<string, Readonly<Record<string, Link>>>>
    | undefined
  /** Immutable literal imports resolved from supplied source modules. */
  readonly constants?: Readonly<Record<string, Ast.Node>> | undefined
  /** Published class lists of imported callable definitions. */
  readonly styleClasses?: Readonly<Record<string, string>> | undefined
  /** Locally imported stylesheet factories resolved through source barrels. */
  readonly factories?: Readonly<Record<string, string>> | undefined
  readonly extracted?: Source.extract.ReturnType | undefined
  readonly links: Readonly<Record<string, Link>>
  readonly owners?:
    | Readonly<Record<string, { call: Call; moduleId: string; source: string }>>
    | undefined
}

/** Collects immutable module-level themes without evaluating source. */
export function collect(program: Ast.Program, options: collect.Options) {
  const staticTokens: Ast.Node[] = []
  const aliases: Alias[] = []
  const aliasBindings = new Map<number, Alias>()
  const aliasReferences = new Set<number>()
  const appearances = new Set<string>()
  const scopeApplications = new Map<
    number,
    { end: number; output: 'html' | undefined }
  >()
  const selections = new Set<string>()
  const calls: Call[] = []
  const scripts = new Set<string>()
  const definitions = new Map<number, Call>()
  const factories = new Set<number>()
  const imports = new Set<number>()
  const variableImports = new Set<number>()
  const configImports = new Set<number>()
  const configs = new Map<string, Link>()
  const configBindings = new Map<number, Link>()
  const factoryReferences = new Set<number>()
  const references: Reference[] = []

  const styles = new Map<
    number,
    {
      call: Ast.CallExpression
      recipe?: boolean | undefined
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
          : specifier.imported.value) === 'Vars'
      ) {
        imports.add(specifier.start)
        variableImports.add(specifier.start)
      } else if (
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
      if (
        !link ||
        link.kind === 'style-reference' ||
        link.kind === 'animation' ||
        link.kind === 'rule-reference' ||
        link.kind === 'variables'
      )
        continue

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
  const variableNamespaces = new Set<string>()
  for (const node of program.body)
    if (node.type === 'ImportDeclaration')
      for (const specifier of node.specifiers)
        if (variableImports.has(specifier.start))
          variableNamespaces.add(specifier.local.name)

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

    const config =
      root.type === 'Identifier' ? configs.get(root.name) : undefined

    if (
      config &&
      !config.call.selection &&
      !config.call.initialization &&
      !config.call.root &&
      path.length === 1 &&
      ['themes', 'vars', 'script', 'appearance'].includes(path[0]!)
    ) {
      const key = path[0]!
      if (config.call.variableConfig && key === 'themes') return undefined

      if (key === 'script') scripts.add(config.call.name)
      if (key === 'appearance') appearances.add(config.call.name)

      if (key === 'themes' && !config.call.options?.themes) return undefined
      if (key === 'themes' || key === 'vars') selections.add(config.call.name)

      if (key === 'script' && !config.call.script)
        fail(
          'This packed configuration does not provide script(); rebuild its library with initialization support.',
          node,
        )

      if (key === 'appearance' && !config.call.appearance)
        fail(
          'This packed configuration does not provide appearance; rebuild its library with root control support.',
          node,
        )

      const members = Object.fromEntries(
        Object.entries(config.members ?? {}).flatMap(([name, member]) => {
          const parts = JSON.parse(name) as string[]

          return (key === 'themes' || key === 'vars') && parts[0] === 'themes'
            ? [[JSON.stringify(parts.slice(1)), member]]
            : []
        }),
      )

      return {
        ...config,
        members,
        binding: `${config.binding}:${key}`,
        call: {
          ...config.call,
          members: Object.fromEntries(
            Object.entries(members).map(([name, member]) => [
              name,
              member.call.name,
            ]),
          ),
          ...helper(key),
          type: `${config.call.type}['${key}']`,
        },
      }
    }

    return config?.members?.[JSON.stringify(path)]
  }

  /** Marks which configuration helper a destructured or member binding represents. */
  function helper(key: string) {
    if (key === 'script') return { initialization: true }
    if (key === 'appearance') return { root: true }
    return { selection: true }
  }

  type Derived = { name: string; vars: Vars.Definition }

  function readReference(
    node: Ast.Node,
    derived?: Derived,
  ): Token.Reference | undefined {
    if (node.type !== 'MemberExpression') return undefined
    const path: string[] = []
    let root: Ast.Node = node
    while (root.type === 'MemberExpression' && !root.optional) {
      const key =
        !root.computed && root.property.type === 'Identifier'
          ? root.property.name
          : root.property.type === 'Literal'
            ? String(root.property.value)
            : undefined
      if (key === undefined) return undefined
      path.unshift(key)
      root = root.object
    }
    if (root.type !== 'Identifier') return undefined
    const local = derived?.name === root.name
    const call = names.get(root.name)
    if (!local && !call) return undefined
    let value: unknown = local ? derived.vars : themes[call!.name]?.tokens
    if (!local && !call!.variableSet && !call!.directVariables) {
      if (!['vars', 'tokens'].includes(path.shift()!)) return undefined
    }
    for (const key of path)
      value =
        value && typeof value === 'object'
          ? Object.getOwnPropertyDescriptor(value, key)?.value
          : undefined
    return Token.is(value) ? value : undefined
  }

  function data(node: Ast.Node, derived?: Derived): unknown {
    const reference = readReference(node, derived)
    if (reference) {
      factoryReferences.add(node.start)
      return reference
    }

    if (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression')
      return data(node.expression, derived)

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

        return data(element, derived)
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

      result[key] = data(property.value, derived)
    }

    return result
  }

  function fail(message: string, node: Pick<Ast.Node, 'end' | 'start'>): never {
    throw new InvalidError(message, node)
  }

  function type(node: Ast.Node): string {
    if (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression')
      return type(node.expression)

    if (node.type !== 'ObjectExpression') return Configurations.type(data(node))

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

      let name = `${options.namespace}-${binding}`
      if (
        !configNamespaces.has(expression.callee.object.name) &&
        member.property.name === 'define'
      ) {
        const argument = expression.arguments[1]
        const callback = argument && Expression.unwrap(argument)
        const id = Identifiers.explicit(
          expression,
          callback?.type === 'ArrowFunctionExpression' ||
            callback?.type === 'FunctionExpression'
            ? 2
            : 1,
        )
        if (id !== undefined) name = Identity.requireId(id, 'Vars.define')
      }

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
            if (
              (key === 'style' || key === 'variants') &&
              !link.call.selection &&
              !link.call.initialization
            ) {
              const alias = {
                ...link.call,
                recipe: key === 'variants',
                destructured: false,
              }

              aliasBindings.set(id.start, alias)
              aliasNames.set(id.name, alias)

              if (statement.type === 'ExportNamedDeclaration')
                exports[id.name] = {
                  ...link,
                  binding: `${options.namespace}-${id.name}`,
                  call: alias,
                  kind: 'style',
                }

              continue
            }

            if (
              !link.call.selection &&
              !link.call.initialization &&
              !link.call.root &&
              (key === 'script' ||
                key === 'appearance' ||
                (key === 'themes' && link.call.options?.themes) ||
                (key === 'vars' && link.call.variableConfig))
            ) {
              if (
                (key === 'script' && !link.call.script) ||
                (key === 'appearance' && !link.call.appearance) ||
                link.call.selection ||
                link.call.initialization
              )
                fail(
                  'This configuration helper is not available on the linked contract.',
                  id,
                )

              if (key === 'script') scripts.add(link.call.name)
              if (key === 'appearance') appearances.add(link.call.name)
              if (key === 'themes' || key === 'vars')
                selections.add(link.call.name)

              const members = Object.fromEntries(
                Object.entries(link.members ?? {}).flatMap(
                  ([pathKey, member]) => {
                    const path = JSON.parse(pathKey) as string[]

                    return (key === 'themes' || key === 'vars') &&
                      (path[0] === 'themes' || path[0] === 'vars')
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
                  ...helper(key),
                  type: `${link.call.type}['${key}']`,
                },
              }

              configs.set(id.name, selection)
              configBindings.set(id.start, selection)

              if (statement.type === 'ExportNamedDeclaration')
                exports[id.name] = selection

              continue
            }

            if (link.call.variableConfig && ['theme', 'themes'].includes(key))
              fail('Use vars for references and scope selection.', id)

            const member = link.members?.[JSON.stringify([key])]

            if (!member)
              fail(
                'Destructure only style and the configured single theme; other helpers remain unsupported.',
                id,
              )

            definitions.set(id.start, member.call)
            names.set(id.name, member.call)

            if (statement.type === 'ExportNamedDeclaration')
              exports[id.name] = member
          }
        } catch (error) {
          if (
            !(error instanceof Config.InvalidError) &&
            !(error instanceof Vars.InvalidError)
          )
            throw error

          fail(error.message, expression)
        }

        continue
      }

      let definition: Theme.Definition
      let tokenType: string
      let output: Call['output']

      try {
        if (member.property.name === 'define') {
          if (
            expression.arguments.length < 1 ||
            expression.arguments.length > 3
          )
            fail(
              'Vars.define requires one literal variable object.',
              expression,
            )

          let input = data(expression.arguments[0]!)

          tokenType = type(expression.arguments[0]!)

          const variableSet = variableNamespaces.has(
            expression.callee.object.name,
          )
          const argument = expression.arguments[1]
          const callback = argument && Expression.unwrap(argument)
          if (
            variableSet &&
            (callback?.type === 'ArrowFunctionExpression' ||
              callback?.type === 'FunctionExpression')
          ) {
            const parameter = callback.params[0]
            const body = (() => {
              if (callback.body?.type !== 'BlockStatement') return callback.body
              if (
                callback.body.body.length === 1 &&
                callback.body.body[0]?.type === 'ReturnStatement'
              )
                return callback.body.body[0].argument
              return undefined
            })()
            if (
              callback.async ||
              callback.generator ||
              callback.params.length !== 1 ||
              parameter?.type !== 'Identifier' ||
              !body
            )
              fail(
                'Derived variables require one named parameter and a literal return value.',
                callback,
              )

            const base = VariableSets.build(
              input,
              Object.freeze({ variableSet: true, [Token.identity]: name }),
            )
            input = VariableSets.merge(
              input,
              data(body, { name: parameter.name, vars: base }),
            )
            tokenType = Configurations.type(input)
          } else if (expression.arguments.length > 2)
            fail(
              'Vars.define accepts a third argument only with a derived callback.',
              expression,
            )

          const original = variableSet
            ? VariableSets.theme(
                VariableSets.build(
                  input,
                  Object.freeze({ variableSet: true, [Token.identity]: name }),
                ),
              )
            : Theme.define(input as Theme.Tokens)

          definition = Token.bind(
            original,
            Object.freeze({
              ...original[Token.definition].contract,
              [Token.identity]: name,
            }),
          )
        } else {
          const base = expression.arguments[0]
          const parent = base ? resolve(base)?.call : undefined

          if (expression.arguments.length !== 2 || !parent)
            fail(
              'Vars.extend requires a preceding variable set and literal overrides.',
              expression,
            )

          factoryReferences.add(base!.start)
          definition = variableNamespaces.has(expression.callee.object.name)
            ? VariableSets.theme(
                Vars.extend(
                  VariableSets.from(themes[parent.name]![Token.definition]),
                  data(expression.arguments[1]!) as Vars.Overrides<Vars.Values>,
                ),
              )
            : Theme.extend(
                themes[parent.name]!,
                data(expression.arguments[1]!) as Theme.Overrides<Theme.Tokens>,
              )
          if (
            definition[Token.definition].contract[Token.identity]?.startsWith(
              'id-',
            )
          )
            name = definition.className.slice('z_theme-'.length)
          tokenType = parent.tokenType
          output = parent.output
        }
      } catch (error) {
        if (error instanceof InvalidError) throw error
        if (
          !(error instanceof Theme.InvalidError) &&
          !(error instanceof Vars.InvalidError)
        )
          throw error

        fail(error.message, expression)
      }

      const call = Object.freeze({
        ...(variableNamespaces.has(expression.callee.object.name)
          ? {
              variableSet: true,
              directVariables: true,
              type: `import('zyzz').Vars.Definition<${tokenType}>`,
            }
          : {}),
        ...(output ? { output } : {}),
        end: expression.end,
        name,
        start: expression.start,
        tokenType,
        ...(definition[Token.definition].contract.shorthands ||
        output === 'html'
          ? {
              type: `import('zyzz').Config.create.ReturnType<{theme:${tokenType};${output === 'html' ? "output:'html';" : ''}shorthands:${Configurations.type(definition[Token.definition].contract.shorthands ?? {})}}>['theme']`,
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

    if (linked?.kind === 'config' && variable.id.type === 'ObjectPattern') {
      if (statement.type === 'ExportNamedDeclaration' && !options.linked)
        fail(
          'Exported configuration destructuring requires source linking.',
          variable,
        )

      if (declaration.kind !== 'const')
        fail('Configuration destructuring requires const bindings.', variable)

      const link = linked

      const bindings = variable.id.properties.map((property) => {
        if (
          property.type !== 'Property' ||
          property.computed ||
          property.key.type !== 'Identifier' ||
          property.value.type !== 'Identifier'
        )
          return fail(
            'Configuration destructuring requires named bindings without defaults or rest.',
            property,
          )

        return { key: property.key.name, id: property.value }
      })

      aliasReferences.add(expression.start)
      aliases.push({
        ...link.call,
        start: expression.start,
        end: expression.end,
        destructured: false,
        retained: true,
      })

      for (const { key, id } of bindings) {
        if (
          (key === 'style' || key === 'variants') &&
          !link.call.selection &&
          !link.call.initialization
        ) {
          const alias = {
            ...link.call,
            recipe: key === 'variants',
            destructured: false,
          }

          aliasBindings.set(id.start, alias)
          aliasNames.set(id.name, alias)

          if (statement.type === 'ExportNamedDeclaration')
            exports[id.name] = {
              ...link,
              binding: `${options.namespace}-${id.name}`,
              call: alias,
              kind: 'style',
            }

          continue
        }

        if (
          !link.call.selection &&
          !link.call.initialization &&
          !link.call.root &&
          (key === 'script' ||
            key === 'appearance' ||
            (key === 'themes' && link.call.options?.themes) ||
            (key === 'vars' && link.call.variableConfig))
        ) {
          if (
            (key === 'script' && !link.call.script) ||
            (key === 'appearance' && !link.call.appearance) ||
            link.call.selection ||
            link.call.initialization
          )
            fail(
              'This configuration helper is not available on the linked contract.',
              id,
            )

          if (key === 'script') scripts.add(link.call.name)
          if (key === 'appearance') appearances.add(link.call.name)
          if (key === 'themes' || key === 'vars') selections.add(link.call.name)

          const members = Object.fromEntries(
            Object.entries(link.members ?? {}).flatMap(([pathKey, member]) => {
              const path = JSON.parse(pathKey) as string[]

              return (key === 'themes' || key === 'vars') &&
                (path[0] === 'themes' || path[0] === 'vars')
                ? [[JSON.stringify(path.slice(1)), member]]
                : []
            }),
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
              ...helper(key),
              type: `${link.call.type}['${key}']`,
            },
          }

          configs.set(id.name, selection)
          configBindings.set(id.start, selection)

          if (statement.type === 'ExportNamedDeclaration')
            exports[id.name] = selection

          continue
        }

        if (link.call.variableConfig && ['theme', 'themes'].includes(key))
          fail('Use vars for references and scope selection.', id)

        const member = link.members?.[JSON.stringify([key])]

        if (!member)
          fail(
            'Destructure only style and the configured single theme; other helpers remain unsupported.',
            id,
          )

        definitions.set(id.start, member.call)
        names.set(id.name, member.call)

        if (statement.type === 'ExportNamedDeclaration')
          exports[id.name] = member
      }

      return
    }

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
        ['style', 'variants'].includes(expression.property.name)
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

    const bindings = (() => {
      if (destructured && variable.id.type === 'ObjectPattern') {
        if (!variable.id.properties.length)
          fail(
            'Theme destructuring requires an authoring binding.',
            variable.id,
          )

        return variable.id.properties.map((property) => {
          if (
            property.type !== 'Property' ||
            property.computed ||
            property.key.type !== 'Identifier' ||
            (property.key.name !== 'style' &&
              property.key.name !== 'variants') ||
            property.value.type !== 'Identifier'
          )
            fail(
              'Destructure only style or variants into const bindings without defaults or rest properties.',
              property,
            )

          return { id: property.value, member: property.key.name } as const
        })
      }

      if (variable.id.type !== 'Identifier')
        fail('Theme authoring aliases require named const bindings.', variable)

      const recipe =
        expression.type === 'MemberExpression' &&
        expression.property.type === 'Identifier'
          ? expression.property.name === 'variants'
          : theme.recipe
      return [
        {
          id: variable.id,
          member: recipe ? ('variants' as const) : ('style' as const),
        },
      ]
    })()

    if (
      declaration.kind !== 'const' ||
      (statement.type === 'ExportNamedDeclaration' && !options.linked)
    )
      fail(
        'Theme style aliases require a local module-level const binding.',
        variable,
      )

    if (expression.start < theme.end)
      fail('Theme style aliases must follow their definition.', expression)

    for (const [index, { id, member }] of bindings.entries()) {
      const alias = Object.freeze({
        recipe: member === 'variants',
        destructured,
        end: expression.end,
        name: theme.name,
        start: expression.start,
        tokenType: theme.tokenType,
        type: theme.type,
        options: theme.options,
        variableConfig: theme.variableConfig,
        variableMappings: theme.variableMappings,
        output: theme.output,
      })

      // Each local/exported name keeps its own callable identity, while the
      // shared initializer is rewritten once with every destructured member.
      if (index === 0)
        aliases.push({
          ...alias,
          bindings: bindings.map(({ member }) => member),
        })
      aliasBindings.set(id.start, alias)
      aliasNames.set(id.name, alias)

      if (statement.type === 'ExportNamedDeclaration')
        exports[id.name] = {
          binding: `${options.namespace}-${id.name}`,
          call: alias,
          definition: themes[alias.name]!,
          kind: 'style',
        }
    }
    aliasReferences.add(source.start)
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
            kind: names.has(name) ? 'theme' : 'style',
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
        fail('Theme style alias references must follow their definition.', node)

      if (aliasReferences.has(node.start)) return true

      if (
        parent.type !== 'CallExpression' ||
        parent.callee !== node ||
        parent.optional
      )
        fail(
          'Theme style aliases support direct calls only; exporting or escaping them requires source linking.',
          node,
        )

      styles.set(parent.start, {
        call: parent,
        recipe: alias.recipe,
        theme: themes[alias.name]!,
        output:
          alias.output ??
          (alias.options?.output === 'html' ? 'html' : undefined),
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

      // Root controls are an ordinary runtime object; any read or call is valid.
      if (config.call.root) {
        appearances.add(config.call.name)

        return true
      }

      if (
        (config.call.selection || config.call.initialization) &&
        parent.type === 'CallExpression' &&
        parent.callee === node &&
        !parent.optional
      ) {
        if (config.call.selection && config.call.catalogOnly)
          fail(
            'This legacy catalog is not callable; rebuild its library.',
            node,
          )

        if (config.call.selection) {
          selections.add(config.call.name)
          scopeApplications.set(parent.start, {
            end: parent.end,
            output: config.call.options?.output === 'html' ? 'html' : undefined,
          })
        }
        if (config.call.initialization) scripts.add(config.call.name)

        return true
      }

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
          path[0] === 'appearance' &&
          !config.call.selection &&
          !config.call.initialization
        ) {
          if (!config.call.appearance)
            fail(
              'This packed configuration does not provide appearance; rebuild its library with root control support.',
              target,
            )

          appearances.add(config.call.name)

          return true
        }

        if (
          path.length === 1 &&
          !config.call.selection &&
          !config.call.initialization &&
          ['script', 'themes', 'vars'].includes(path[0]!) &&
          ancestors[index - 1]?.type === 'CallExpression' &&
          (ancestors[index - 1] as Ast.CallExpression).callee === target &&
          !(ancestors[index - 1] as Ast.CallExpression).optional
        ) {
          if (path[0] === 'vars' && !config.call.variableConfig)
            fail('This configuration has no vars.', target)
          if (path[0] === 'themes' && !config.call.options?.themes)
            fail('Theme selection requires a named catalog.', target)

          if (
            (path[0] === 'themes' || path[0] === 'vars') &&
            config.call.catalogOnly
          )
            fail(
              'This legacy catalog is not callable; rebuild its library.',
              target,
            )

          if (path[0] === 'script') {
            if (!config.call.script)
              fail(
                'This packed configuration does not provide script(); rebuild its library with initialization support.',
                target,
              )

            scripts.add(config.call.name)
          }

          if (path[0] === 'themes' || path[0] === 'vars') {
            selections.add(config.call.name)
            const application = ancestors[index - 1]!
            scopeApplications.set(application.start, {
              end: application.end,
              output:
                config.call.options?.output === 'html' ? 'html' : undefined,
            })
          }

          return true
        }

        if (
          path.length === 1 &&
          (path[0] === 'style' || path[0] === 'variants')
        ) {
          const call = ancestors[index - 1]

          if (
            call?.type !== 'CallExpression' ||
            call.callee !== target ||
            call.optional
          )
            break

          styles.set(call.start, {
            call,
            recipe: path[0] === 'variants',
            theme: config.definition,
            output: config.call.options?.output === 'html' ? 'html' : undefined,
          })

          return true
        }

        if (
          config.call.variableConfig &&
          ['theme', 'themes'].includes(path[0]!)
        )
          fail('Use vars for references and scope selection.', target)
        const linked =
          config.call.variableConfig && config.call.selection
            ? undefined
            : config.members?.[JSON.stringify(path)]
        if (linked)
          return themeReference(
            target,
            ancestors[index - 1]!,
            ancestors.slice(0, index + 1),
            linked.call,
          )
      }

      if (config.call.selection && config.call.variableConfig && path.length)
        return themeReference(node, parent, ancestors, {
          ...config.call,
          directVariables: true,
        })

      // A compiled selector is an ordinary runtime function, so passing or storing it is safe.
      if (config.call.selection && !config.call.catalogOnly && !path.length) {
        selections.add(config.call.name)

        return true
      }

      fail(
        'Use direct configuration style calls or static theme members; configurations cannot escape or be mutated.',
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
    if (
      factoryReferences.has(node.start) ||
      ancestors.some((ancestor) => factoryReferences.has(ancestor.start))
    )
      return true
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
      (theme.directVariables ||
        (parent.property.type === 'Identifier' &&
          !parent.computed &&
          ['tokens', 'vars'].includes(parent.property.name)) ||
        (parent.property.type === 'Literal' &&
          parent.computed &&
          ['tokens', 'vars'].includes(String(parent.property.value))))
    ) {
      if (parent.optional)
        fail('Token references cannot use optional access.', parent)

      const variable =
        theme.directVariables ||
        (parent.property.type === 'Identifier'
          ? parent.property.name === 'vars'
          : parent.property.type === 'Literal' &&
            parent.property.value === 'vars')

      let value: unknown =
        variable && !theme.directVariables
          ? themes[theme.name]!.vars
          : themes[theme.name]!.tokens
      let target: Ast.Node = theme.directVariables ? node : parent
      let index = ancestors.length - (theme.directVariables ? 2 : 3)

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
      ) {
        if (
          ancestors.some(
            (node) =>
              node.type === 'VariableDeclarator' &&
              options.staticBindings?.has(node.start),
          )
        )
          staticTokens.push(valueTarget)
        else
          fail(
            'Token references must be direct property values in bound theme style calls.',
            target,
          )
      }

      tokens.set(valueTarget.start, { end: valueTarget.end, reference })

      const unwrapped = Expression.unwrap(valueTarget)

      tokens.set(unwrapped.start, { end: unwrapped.end, reference })

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
        'Use Config.create or Vars.extend with variable definitions; other references require source linking.',
        node,
      )

    if (
      ['style', 'variants'].includes(parent.property.name) &&
      grandparent?.type === 'CallExpression' &&
      grandparent.callee === parent &&
      !grandparent.optional
    ) {
      styles.set(grandparent.start, {
        call: grandparent,
        recipe: parent.property.name === 'variants',
        theme: themes[theme.name]!,
        output: theme.output,
      })

      return true
    }

    if (parent.property.name !== 'className')
      fail(
        'Only direct theme.style calls and theme.className reads are supported here.',
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
      !link.call.root
    ) {
      if (link.call.script) scripts.add(link.call.name)
      if (link.call.appearance) appearances.add(link.call.name)
    }

  const nativeContexts = new Map<
    Token.Contract,
    NonNullable<Source.Call['nativeContext']>
  >()
  return {
    nativeContext(start: number, end: number) {
      const theme = styles.get(start)?.theme
      const contract =
        theme?.[Token.definition].contract ??
        [...tokens].find(([offset]) => offset >= start && offset < end)?.[1]
          .reference.contract
      if (!contract) return undefined
      const cached = nativeContexts.get(contract)
      if (cached) return cached
      const config = [...configs.values()].find(
        (value) => value.definition[Token.definition].contract === contract,
      )
      if (!config?.call.options?.themes) {
        const alias = [...aliasNames.values()].find(
          (value) =>
            themes[value.name]?.[Token.definition].contract === contract &&
            value.options?.themes,
        )
        if (!alias?.options?.themes) return undefined
        const context = {
          defaultVars: String(alias.options.defaultTheme),
          vars: Object.fromEntries(
            Object.entries(
              alias.options.themes as Record<
                string,
                Parameters<typeof Theme.define>[0]
              >,
            ).map(([name, values]) => [
              name,
              Token.bind(
                contract.variableSet
                  ? VariableSets.theme(Vars.define(values as Vars.Values))
                  : Theme.define(values),
                contract,
              ),
            ]),
          ),
        }
        Object.freeze(context.vars)
        nativeContexts.set(contract, Object.freeze(context))
        return context
      }
      const entries = Object.entries(config.members ?? {}).flatMap(
        ([key, value]) => {
          const path = JSON.parse(key) as string[]
          return (path[0] === 'themes' || path[0] === 'vars') &&
            path.length === 2
            ? [[path[1]!, value.definition] as const]
            : []
        },
      )
      const context = Object.freeze({
        defaultVars: String(config.call.options.defaultTheme),
        vars: Object.freeze(Object.fromEntries(entries)),
      })
      nativeContexts.set(contract, context)
      return context
    },
    aliases,
    appearances,
    calls,
    exports: Object.freeze(exports),
    reference,
    references,
    scopeApplications,
    scripts,
    selections,
    staticTokens,
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
    readonly staticBindings?: ReadonlySet<number> | undefined
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
