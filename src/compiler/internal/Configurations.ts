/**
 * Normalizes literal configuration syntax into linked theme members.
 * @module
 */
import * as Identity from '../../internal/Identity.js'
import type * as Ast from '@oxc-project/types'
import * as Config from '../../internal/Configuration.js'
import * as PublicConfig from '../../Config.js'
import * as Shorthands from '../../internal/Shorthands.js'
import * as Token from '../../internal/Token.js'
import * as Theme from '../../internal/Theme.js'
import * as VariableSets from '../../internal/VariableSets.js'
import * as Vars from '../../Vars.js'
import type * as Themes from './Themes.js'

/** Reads a direct configuration factory without executing authored expressions. */
export function collect(options: collect.Options): Themes.Link {
  function data(node: Ast.Node): unknown {
    const linked = options.resolve(node)
    if (
      linked?.kind === 'theme' ||
      (linked?.call.variableConfig && linked.call.selection)
    )
      return linked.definition[Token.definition].contract.variableSet
        ? VariableSets.from(linked.definition[Token.definition])
        : linked.definition

    if (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression')
      return data(node.expression)

    if (node.type === 'Literal' && typeof node.value === 'boolean')
      return node.value

    if (node.type === 'ArrayExpression')
      return node.elements.map((node) => {
        if (!node || node.type === 'SpreadElement')
          throw new Config.InvalidError(
            'Configuration arrays require literal entries.',
          )

        return data(node)
      })

    if (node.type === 'ObjectExpression') {
      const entries: Record<string, unknown> = Object.create(null)

      for (const property of node.properties) {
        if (
          property.type !== 'Property' ||
          property.computed ||
          property.method ||
          property.kind !== 'init'
        )
          throw new Config.InvalidError(
            'Configuration requires static properties without spreads or methods.',
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
        if (key === undefined || Object.hasOwn(entries, key))
          throw new Config.InvalidError(
            'Configuration requires unique literal keys.',
          )

        entries[key] = data(property.value)
      }

      return entries
    }

    return options.data(node)
  }

  if (options.expression.arguments.length > 1)
    throw new Config.InvalidError(
      'Config.create accepts one literal options object.',
    )

  let input = (
    options.expression.arguments.length
      ? data(options.expression.arguments[0]!)
      : {}
  ) as Config.create.Options

  PublicConfig.create(input as unknown as PublicConfig.create.Options)

  const authored = input as unknown as Config.VariableOptions
  const variableMode = authored.vars !== undefined
  if (variableMode) {
    Config.create(authored)
    const wrap = (value: Vars.Definition | Vars.Values) =>
      VariableSets.theme(
        Token.definition in value
          ? (value as Vars.Definition)
          : Vars.define(value as Vars.Values),
        authored.mappings,
      )
    const { vars, defaultVars, mappings: _mappings, ...rest } = authored
    input =
      defaultVars === undefined
        ? { ...rest, theme: wrap(vars as Vars.Definition) }
        : {
            ...rest,
            defaultTheme: defaultVars,
            themes: Object.fromEntries(
              Object.entries(vars).map(([key, value]) => [
                key,
                wrap(value as Vars.Definition),
              ]),
            ),
          }
  }
  const config = Config.create(input)

  const catalog = (() => {
    if ('themes' in config) {
      return config.themes
    }

    if ('theme' in config) {
      return { theme: config.theme }
    }

    return {}
  })()

  const identity =
    input.id === undefined
      ? options.name
      : Identity.requireId(input.id, 'Config.create')
  const contract = Object.freeze({
    ...(variableMode
      ? {
          variableSet: true,
          mappings: VariableSets.mappings(authored.mappings),
        }
      : {}),
    [Token.identity]: identity,
    cssOutput: input.cssOutput ?? 'atomic',
    ...(input.strict === true ? { strict: true } : {}),
    ...(input.defaultLayer !== undefined
      ? { defaultLayer: input.defaultLayer }
      : {}),
    ...(input.shorthands
      ? { shorthands: Shorthands.read(input.shorthands) }
      : {}),
  })

  const members: Record<string, Themes.Link> = Object.create(null)

  for (const [key, original] of Object.entries(catalog)) {
    const name = `${identity}-${key}`
    const definition = Token.bind(original, contract)
    const tokenType = type({
      ...values(original.tokens),
      ...original[Token.definition].queries,
    })

    const call = {
      ...(input.output === 'html' ? { output: 'html' as const } : {}),
      end: options.expression.end,
      name,
      start: options.expression.start,
      tokenType,
      ...(input.output === 'html' || input.shorthands
        ? {
            type: `import('zyzz').Config.create.ReturnType<{theme:${tokenType};${input.output === 'html' ? "output:'html';" : ''}shorthands:${type(input.shorthands ?? {})}}>['theme']`,
          }
        : {}),
    }

    members[JSON.stringify('themes' in config ? ['themes', key] : ['theme'])] =
      {
        binding: name,
        call,
        definition,
        kind: 'theme',
      }
  }

  const selected =
    members[
      JSON.stringify(
        'themes' in config ? ['themes', input.defaultTheme] : ['theme'],
      )
    ]

  if ('themes' in config && selected)
    members[JSON.stringify(['theme'])] = selected

  if (variableMode && selected)
    members[JSON.stringify(['vars'])] = {
      ...selected,
      call: {
        ...selected.call,
        directVariables: true,
        type: `import('zyzz').Vars.References<${selected.call.tokenType}>`,
      },
    }

  const definition =
    selected?.definition ?? Token.bind(Theme.define({}), contract)

  const normalized = {
    ...(() => {
      if ('themes' in config) {
        return {
          defaultTheme: input.defaultTheme,
          themes: Object.fromEntries(
            Object.keys(catalog).map((name) => {
              const theme =
                members[JSON.stringify(['themes', name])]!.definition!
              return [
                name,
                { ...values(theme.tokens), ...theme[Token.definition].queries },
              ]
            }),
          ),
        }
      }

      if ('theme' in config) {
        return {
          theme: {
            ...values(definition.tokens),
            ...definition[Token.definition].queries,
          },
        }
      }

      return {}
    })(),
    ...(input.cssOutput ? { cssOutput: input.cssOutput } : {}),
    ...(input.strict === true ? { strict: true } : {}),
    ...(input.defaultLayer !== undefined
      ? { defaultLayer: input.defaultLayer }
      : {}),
    ...(input.shorthands ? { shorthands: input.shorthands } : {}),
    ...(input.output ? { output: input.output } : {}),
    ...(input.layers ? { layers: input.layers } : {}),
    ...(input.storageKey ? { storageKey: input.storageKey } : {}),
  }

  return {
    binding: options.name,
    call: {
      ...(variableMode
        ? { variableConfig: true, variableMappings: authored.mappings }
        : {}),
      appearance: true,
      script: true,
      end: options.expression.end,
      members: Object.fromEntries(
        Object.entries(members).map(([key, link]) => [key, link.call.name]),
      ),
      name: selected?.call.name ?? options.name,
      options: normalized,
      start: options.expression.start,
      tokenType: selected?.call.tokenType ?? '{}',
      type: variableMode
        ? `import('zyzz').Config.VariableConfig<${type({ ...normalized, theme: undefined, themes: undefined, defaultTheme: undefined, vars: 'themes' in normalized ? normalized.themes : normalized.theme, ...('themes' in normalized ? { defaultVars: normalized.defaultTheme } : {}), ...(authored.mappings !== undefined ? { mappings: VariableSets.mappings(authored.mappings) } : {}) })}>`
        : `import('zyzz').Config.create.ReturnType<${type(normalized)}>`,
    },
    definition,
    kind: 'config',
    members,
  }
}

/** Inputs supplied by the lexical theme collector. */
export declare namespace collect {
  /** Literal reader, source span, identity, and preceding immutable bindings. */
  type Options = {
    /** Existing literal theme reader for scalar input. */
    readonly data: (node: Ast.Node) => unknown
    /** Direct module-level configuration factory span. */
    readonly expression: Ast.CallExpression
    /** Stable module/binding identity. */
    readonly name: string
    /** Looks up preceding immutable theme definitions. */
    readonly resolve: (node: Ast.Node) => Themes.Link | undefined
  }
}

/** Encodes validated literal options as a declaration type, never executable text. */
export function type(value: unknown): string {
  if (Token.is(value)) return `import('zyzz').Vars.Reference<'${value.group}'>`
  if (Array.isArray(value)) return `readonly [${value.map(type).join(',')}]`
  if (!value || typeof value !== 'object') return JSON.stringify(value)

  return `{${Object.entries(value)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `readonly ${JSON.stringify(key)}:${type(value)}`)
    .join(';')}}`
}

function values(tree: Theme.References<Theme.Tokens>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      Token.is(value)
        ? value.value
        : values(value as Theme.References<Theme.Tokens>),
    ]),
  )
}
