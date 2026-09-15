/**
 * Normalizes literal configuration syntax into linked theme members.
 * @module
 */
import * as Identity from '../../internal/Identity.js'
import type * as Ast from '@oxc-project/types'
import * as Config from '../../Config.js'
import * as Shorthands from '../../internal/Shorthands.js'
import * as Token from '../../internal/Token.js'
import * as Theme from '../../Theme.js'
import type * as Themes from './Themes.js'

/** Reads a direct configuration factory without executing authored expressions. */
export function collect(options: collect.Options): Themes.Link {
  function data(node: Ast.Node): unknown {
    const linked = options.resolve(node)
    if (linked?.kind === 'theme') return linked.definition

    if (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression')
      return data(node.expression)

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

  const input = (
    options.expression.arguments.length
      ? data(options.expression.arguments[0]!)
      : {}
  ) as Config.create.Options

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
    [Token.identity]: identity,
    cssOutput: input.cssOutput ?? 'atomic',
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

  const definition =
    selected?.definition ?? Token.bind(Theme.define({}), contract)

  const normalized = {
    ...(() => {
      if ('themes' in config) {
        return {
          defaultTheme: input.defaultTheme,
          themes: Object.fromEntries(
            Object.entries(catalog).map(([name, theme]) => [
              name,
              { ...values(theme.tokens), ...theme[Token.definition].queries },
            ]),
          ),
        }
      }

      if ('theme' in config) {
        return {
          theme: {
            ...values(config.theme.tokens),
            ...config.theme[Token.definition].queries,
          },
        }
      }

      return {}
    })(),
    ...(input.cssOutput ? { cssOutput: input.cssOutput } : {}),
    ...(input.shorthands ? { shorthands: input.shorthands } : {}),
    ...(input.output ? { output: input.output } : {}),
    ...(input.layers ? { layers: input.layers } : {}),
    ...(input.storageKey ? { storageKey: input.storageKey } : {}),
  }

  return {
    binding: options.name,
    call: {
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
      type: `import('zyzz').Config.create.ReturnType<${type(normalized)}>`,
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
  if (Array.isArray(value)) return `readonly [${value.map(type).join(',')}]`
  if (!value || typeof value !== 'object') return JSON.stringify(value)

  return `{${Object.entries(value)
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
