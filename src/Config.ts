/**
 * Normalizes explicit configuration into isolated typed authoring contracts.
 * @module
 */
import type * as Binding from './internal/Binding.js'
import type * as Condition from './internal/Condition.js'
import { css, MissingTransformError } from './css.js'
import { variants } from './variants.js'
import * as Shorthands from './internal/Shorthands.js'
import type * as Style from './Style.js'
import * as Theme from './Theme.js'
import * as Token from './internal/Token.js'

/** Creates token-free authoring without a configuration file or global state. */
export function create(): create.ReturnType<{}>
/**
 * Binds inline or reusable themes to an isolated configuration contract.
 * Named themes require an explicit default and identical token paths/domains.
 * Authoring functions still require a source transform; this factory emits no CSS.
 * @throws {InvalidError} If options, themes, defaults, or layer names are invalid.
 */
export function create<const options extends create.Options>(
  options: options & NoInfer<Validated<options>>,
): create.ReturnType<options>
export function create(options: create.Options = {}): unknown {
  const input = record(options)

  for (const key of Object.keys(input))
    if (
      ![
        'cssOutput',
        'defaultTheme',
        'layers',
        'output',
        'shorthands',
        'theme',
        'themes',
      ].includes(key)
    )
      throw new InvalidError(`Unknown configuration option: ${key}`)

  if (
    input.output !== undefined &&
    input.output !== 'html' &&
    input.output !== 'react'
  )
    throw new InvalidError('output must be html or react.')

  if (
    input.cssOutput !== undefined &&
    input.cssOutput !== 'atomic' &&
    input.cssOutput !== 'grouped'
  )
    throw new InvalidError('cssOutput must be atomic or grouped.')

  if (input.theme !== undefined && input.themes !== undefined)
    throw new InvalidError('Use either theme or themes, not both.')

  if (input.layers !== undefined) {
    if (!Array.isArray(input.layers))
      throw new InvalidError('layers must be an array.')

    const seen = new Set<string>()

    for (const layer of input.layers) {
      if (
        typeof layer !== 'string' ||
        !/^(?:--|-?[_a-zA-Z])[\w-]*(?:\.(?:--|-?[_a-zA-Z])[\w-]*)*$/.test(
          layer,
        ) ||
        layer
          .split('.')
          .some((part) =>
            [
              'default',
              'inherit',
              'initial',
              'revert',
              'revert-layer',
              'unset',
            ].includes(part.toLowerCase()),
          )
      )
        throw new InvalidError(
          'Layer names must be plain CSS identifiers, optionally dotted.',
        )

      if (seen.has(layer)) throw new InvalidError(`Duplicate layer: ${layer}`)

      seen.add(layer)
    }
  }

  const script = () => {
    throw new Error(
      'Appearance initialization requires the Zyzz source transform.',
    )
  }

  const shorthands = (() => {
    if (input.shorthands === undefined) return undefined

    try {
      return Shorthands.read(input.shorthands)
    } catch (error) {
      throw new InvalidError((error as Error).message)
    }
  })()

  const contract = Object.freeze({
    cssOutput: options.cssOutput ?? 'atomic',
    ...(shorthands ? { shorthands } : {}),
  })

  if (input.themes !== undefined) {
    const catalog = record(input.themes)
    if (
      typeof input.defaultTheme !== 'string' ||
      !Object.hasOwn(catalog, input.defaultTheme)
    )
      throw new InvalidError('defaultTheme must name a theme in the catalog.')

    const definitions = Object.fromEntries(
      Object.entries(catalog).map(([name, value]) => {
        if (!name) throw new InvalidError('Theme names must be nonempty.')

        return [name, definition(value)]
      }),
    )

    const base = definitions[input.defaultTheme]!
    const paths = Object.keys(base[Token.definition].values).sort()

    function queries(theme: Theme.Definition) {
      const data = theme[Token.definition].queries

      return JSON.stringify({
        breakpoints: Object.keys(data?.breakpoints ?? {}).sort(),
        containers: Object.keys(data?.containers ?? {}).sort(),
        containerNames: [...(data?.containerNames ?? [])].sort(),
      })
    }

    for (const [name, value] of Object.entries(definitions)) {
      const candidate = Object.keys(value[Token.definition].values).sort()
      if (
        queries(base) !== queries(value) ||
        paths.length !== candidate.length ||
        paths.some((path, index) => path !== candidate[index])
      )
        throw new InvalidError(
          `Theme ${JSON.stringify(name)} must have the default theme's complete token paths and domains.`,
        )
    }

    const bound = Object.fromEntries(
      Object.entries(definitions).map(([name, value]) => [
        name,
        Token.bind(value, contract),
      ]),
    )

    const select = () => {
      throw new MissingTransformError()
    }

    Object.defineProperties(select, Object.getOwnPropertyDescriptors(bound))

    return Object.freeze({
      css,
      variants,
      script,
      theme: bound[input.defaultTheme],
      themes: Object.freeze(select),
    })
  }

  if (input.defaultTheme !== undefined)
    throw new InvalidError('defaultTheme requires a named themes catalog.')

  if (input.theme !== undefined)
    return Object.freeze({
      css,
      variants,
      script,
      theme: Token.bind(definition(input.theme), contract),
    })

  return Object.freeze({ css, script, variants })
}

/** Configuration inputs and inferred results. */
export declare namespace create {
  /** Optional layer names and mutually exclusive theme modes. */
  type Options = {
    /** CSS representation inherited by bound helpers; atomic by default. */
    readonly cssOutput?: 'atomic' | 'grouped' | undefined
    /** Explicit ordered property aliases; none are installed by default. */
    readonly shorthands?: Shorthands.Map | undefined
    /** Renderer props format; React is the default. */
    readonly output?: css.Output | undefined
    /** Ordered plain or dotted CSS layer names; emission follows source integration. */
    readonly layers?: readonly string[] | undefined
  } & (
    | {
        /** Single inline or reusable theme. */ readonly theme: Input
        /** Named mode is excluded. */ readonly themes?: never
        /** Only named catalogs use defaults. */ readonly defaultTheme?: never
      }
    | {
        /** Explicit catalog key. */ readonly defaultTheme: string
        /** Single mode is excluded. */ readonly theme?: never
        /** Complete named theme alternatives. */ readonly themes: Readonly<
          Record<string, Input>
        >
      }
    | {
        /** Only named catalogs use defaults. */ readonly defaultTheme?: never
        /** Omit themes for token-free authoring. */ readonly theme?: never
        /** Omit themes for token-free authoring. */ readonly themes?: never
      }
  )

  /** Bound authoring and the handles corresponding to the selected theme mode. */
  type ReturnType<options extends Options = Options> = {
    /** Inferred callable authoring; execution requires a source transform. */
    readonly css: Css<
      Tokens<options>,
      options extends { layers: readonly (infer name extends string)[] }
        ? name
        : never,
      options extends { output: infer output extends css.Output }
        ? output
        : 'react',
      Mappings<options>
    >
    /** Theme-, layer-, and mapping-aware recipe authoring. */
    readonly variants: variants.Bound<
      Tokens<options>,
      options extends { output: infer output extends css.Output }
        ? output
        : 'react',
      options extends { layers: readonly (infer name extends string)[] }
        ? name
        : never,
      Mappings<options>
    >
    /** Generates synchronous HTML-safe root preference restoration. */
    readonly script: (options?: ScriptOptions) => string
  } & (options extends { theme: infer input }
    ? {
        /** Isolated single-theme contract. */ reado…20062 tokens truncated…(
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

  const contract = Object.freeze({
    [Token.identity]: options.name,
    cssOutput: input.cssOutput ?? 'atomic',
    ...(input.shorthands
      ? { shorthands: Shorthands.read(input.shorthands) }
      : {}),
  })

  const members: Record<string, Themes.Link> = Object.create(null)

  for (const [key, original] of Object.entries(catalog)) {
    const name = `${options.name}-${key}`
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
  }

  return {
    binding: options.name,
    call: {
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
