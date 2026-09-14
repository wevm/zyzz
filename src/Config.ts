/**
 * Normalizes explicit configuration into isolated typed authoring contracts.
 * @module
 */
import * as Appearance from './runtime/Appearance.js'
import * as Authoring from './internal/Authoring.js'
import * as Html from './runtime/CompositionHtml.js'
import * as Identity from './internal/Identity.js'
import type * as Binding from './internal/Binding.js'
import type * as Condition from './internal/Condition.js'
import type { css } from './css.js'
import { variants } from './variants.js'
import * as Scheme from './internal/Scheme.js'
import * as Shorthands from './internal/Shorthands.js'
import type * as Style from './Style.js'
import * as Theme from './Theme.js'
import * as Token from './internal/Token.js'

/** Creates token-free authoring without a configuration file or global state. */
export function create(): create.ReturnType<{}>
/**
 * Binds inline or reusable themes to an isolated configuration contract.
 * Named themes require an explicit default and identical token paths/domains.
 * Bound helpers reference extracted CSS; this factory emits no CSS rules.
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
        'id',
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

  const shorthands = (() => {
    if (input.shorthands === undefined) return undefined

    try {
      return Shorthands.read(input.shorthands)
    } catch (error) {
      throw new InvalidError((error as Error).message)
    }
  })()

  const contract = Object.freeze({
    cssOutput:
      (input.cssOutput as 'atomic' | 'grouped' | undefined) ?? 'atomic',
    ...(shorthands ? { shorthands } : {}),
    ...(typeof input.id === 'string'
      ? {
          [Token.identity]: Identity.requireId(input.id, 'Config.create'),
          [Token.complete]: true,
        }
      : {}),
  })
  function boundCss(theme?: Theme.Definition) {
    return (styles?: unknown, options: css.DefinitionOptions = {}) => {
      if (
        theme &&
        Object.keys(theme[Token.definition].values).length &&
        !contract[Token.identity]
      )
        Identity.requireId(undefined, 'Config.create')
      return Authoring.create(styles, {
        ...options,
        theme,
        output: input.output as css.Output | undefined,
      })
    }
  }
  function boundVariants(
    definition: Record<string, unknown>,
    options: css.DefinitionOptions = {},
  ) {
    return Authoring.variants(definition, {
      ...options,
      output: input.output as css.Output | undefined,
    })
  }
  function handle(theme: Theme.Definition, name: string) {
    const original = Token.bind(theme, contract)
    const className = () =>
      `z_theme-${Identity.requireId(typeof input.id === 'string' ? input.id : undefined, 'Config.create')}-${name.replace(/[^a-zA-Z0-9-]/g, (character) => `_${character.charCodeAt(0).toString(16)}_`)}`
    const select = (options: { colorScheme?: string } = {}) => {
      const scheme = options.colorScheme
      const selection =
        scheme !== undefined && Object.hasOwn(Scheme.classes, scheme)
          ? ` ${Scheme.classes[scheme as Scheme.Name]}`
          : ''
      const result = {
        className: `${className()}${selection}`,
        ...(scheme ? { style: { colorScheme: scheme } } : {}),
      }
      return input.output === 'html' ? Html.from(result) : result
    }
    const descriptors = Object.getOwnPropertyDescriptors(original)
    delete (descriptors as Record<string, unknown>).className
    delete (descriptors as Record<string, unknown>).css
    delete (descriptors as Record<string, unknown>).variants
    Object.defineProperties(select, descriptors)
    Object.defineProperty(select, 'className', {
      get: className,
      configurable: true,
    })
    Object.assign(select, { css: boundCss(original), variants: boundVariants })
    return select
  }

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
        handle(value, name),
      ]),
    )

    const select = (options: { theme: string; colorScheme?: string }) =>
      (bound[options.theme] as (options: { colorScheme?: string }) => unknown)(
        options,
      )

    Object.defineProperties(select, Object.getOwnPropertyDescriptors(bound))

    return Object.freeze({
      css: boundCss(bound[input.defaultTheme] as unknown as Theme.Definition),
      variants: boundVariants,
      script: (options?: ScriptOptions) =>
        Appearance.create(
          Object.entries(bound).map(([name, value]) => [
            name,
            (value as unknown as Theme.Definition).className,
          ]),
        )(options),
      theme: bound[input.defaultTheme],
      themes: Object.freeze(select),
    })
  }

  if (input.defaultTheme !== undefined)
    throw new InvalidError('defaultTheme requires a named themes catalog.')

  if (input.theme !== undefined) {
    const theme = handle(definition(input.theme), 'theme')
    return Object.freeze({
      css: boundCss(theme as unknown as Theme.Definition),
      variants: boundVariants,
      script: Appearance.create([]),
      theme,
    })
  }

  const theme = shorthands ? Token.bind(Theme.define({}), contract) : undefined
  return Object.freeze({
    css: boundCss(theme),
    script: Appearance.create([]),
    variants: boundVariants,
  })
}

/** Configuration inputs and inferred results. */
export declare namespace create {
  /** Optional layer names and mutually exclusive theme modes. */
  type Options = {
    /** CSS representation inherited by bound helpers; atomic by default. */
    readonly cssOutput?: 'atomic' | 'grouped' | undefined
    /** Stable theme identity required without source rewriting. */
    readonly id?: string | undefined
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
        /** Isolated single-theme contract. */ readonly theme: Handle<
          ExtractTokens<input>,
          Mappings<options>,
          options extends { output: infer output extends css.Output }
            ? output
            : 'react'
        >
      }
    : options extends { themes: infer catalog }
      ? {
          /** Shared default token and variable contract. */ readonly theme: Handle<
            Tokens<options>,
            Mappings<options>,
            options extends { output: infer output extends css.Output }
              ? output
              : 'react'
          >
          /** Selects a compiled named scope; catalog members retain compatibility. */ readonly themes: (<
            const selection extends {
              readonly colorScheme?: 'dark' | 'light' | 'light dark' | undefined
              readonly theme: keyof catalog & string
            },
          >(
            options: selection &
              Record<Exclude<keyof selection, 'theme' | 'colorScheme'>, never>,
          ) => css.Props<
            options extends { output: infer output extends css.Output }
              ? output
              : 'react'
          >) & {
            readonly [name in keyof catalog]: Handle<
              ExtractTokens<catalog[name]>,
              Mappings<options>,
              options extends { output: infer output extends css.Output }
                ? output
                : 'react'
            >
          }
        }
      : {})
}

type Mappings<options> = options extends {
  shorthands: infer map extends Shorthands.Map
}
  ? string extends keyof map
    ? {}
    : map
  : {}

/** Theme handle retaining configured shorthands and renderer output in emitted declarations. */
export type Handle<
  tokens extends Theme.Tokens,
  mappings extends Shorthands.Map,
  output extends css.Output,
> = Omit<Theme.Definition<tokens>, 'css' | 'variants'> & {
  /** Style factory bound to this handle. */
  readonly css: Css<tokens, never, output, mappings>
  /** Variant factory bound to this handle. */
  readonly variants: variants.Bound<tokens, output, never, mappings>
}

/** Configured style factory with a portable name for library declaration emission. */
export type Css<
  tokens extends Theme.Tokens,
  layers extends string,
  output extends css.Output,
  mappings extends Shorthands.Map,
> = {
  (): css.ReturnType<output>
  <
    const values extends Record<string, string | number>,
    const styles extends Record<string, unknown>,
    const callback extends (...args: never[]) => unknown,
  >(
    styles: callback &
      ((
        values: values,
      ) => styles &
        NoInfer<
          Body<styles, tokens, layers, mappings> & Binding.Checked<styles>
        >) &
      (values extends Binding.Inputs<values> ? unknown : never) &
      (Parameters<callback> extends [Record<string, string | number>]
        ? unknown
        : never),
    options?: css.DefinitionOptions,
  ): css.Dynamic<values, output>
  <const styles extends Record<string, unknown>>(
    styles: styles & NoInfer<Body<styles, tokens, layers, mappings>>,
    options?: css.DefinitionOptions,
  ): css.ReturnType<output>
}

type Keys<styles> = styles extends unknown ? keyof styles : never

/** Checked declaration body shared by configured styles and recipe choices. */
export type Body<
  styles,
  tokens extends Theme.Tokens,
  layers extends string,
  mappings extends Shorthands.Map,
> = Record<
  Exclude<
    Keys<styles>,
    | keyof mappings
    | 'selectors'
    | 'variables'
    | keyof Style.DeclarationProperties
    | Exclude<Condition.Keys<tokens, Keys<styles>>, `@layer${string}`>
    | '@layer'
    | `@layer ${layers}`
  >,
  never
> &
  (styles extends unknown
    ? {
        [key in keyof styles]: key extends 'selectors'
          ? styles[key] extends Record<string, unknown>
            ? {
                [selector in keyof styles[key]]: styles[key][selector] extends Record<
                  string,
                  unknown
                >
                  ? Body<styles[key][selector], tokens, layers, mappings>
                  : never
              }
            : never
          : key extends
                | Exclude<Condition.Keys<tokens, key>, `@layer${string}`>
                | '@layer'
                | `@layer ${layers}`
            ? styles[key] extends Record<string, unknown>
              ? Body<styles[key], tokens, layers, mappings>
              : never
            : key extends keyof mappings
              ? {
                  [target in mappings[key][number]]: styles[key] extends Style.Accepted<
                    Record<target, styles[key]>,
                    tokens
                  >[target] &
                    Binding.Checked<Record<target, styles[key]>>[target]
                    ? never
                    : target
                }[mappings[key][number]] extends never
                ? styles[key]
                : never
              : Style.Accepted<Pick<styles, key>, tokens>[key]
      }
    : never)

function definition(value: unknown): Theme.Definition {
  try {
    if (
      value &&
      typeof value === 'object' &&
      Object.getOwnPropertyDescriptor(value, Token.definition)?.value
    )
      return value as Theme.Definition

    return Theme.define(record(value) as Theme.Tokens)
  } catch (error) {
    if (error instanceof InvalidError) throw error

    throw new InvalidError((error as Error).message)
  }
}

type ExtractTokens<input> =
  input extends Theme.Definition<infer tokens>
    ? tokens
    : input extends Theme.Tokens
      ? input
      : never

type Input = Theme.Definition | Theme.Tokens

/** Invalid options or incompatible named themes. */
export class InvalidError extends Error {
  /** Creates a configuration diagnostic without generating styles. */
  constructor(message: string) {
    super(message)
  }
  /** Stable namespaced error identifier. */
  override name = 'Config.InvalidError'
}

function record(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![null, Object.prototype].includes(Object.getPrototypeOf(value))
  )
    throw new InvalidError('Expected a plain configuration record.')

  const result: Record<string, unknown> = Object.create(null)

  for (const [key, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(value),
  )) {
    if (!('value' in descriptor))
      throw new InvalidError('Configuration records cannot contain accessors.')

    result[key] = descriptor.value
  }

  return result
}

type Tokens<options> = options extends { theme: infer input }
  ? ExtractTokens<input>
  : options extends { themes: infer catalog; defaultTheme: infer key }
    ? key extends keyof catalog
      ? ExtractTokens<catalog[key]>
      : never
    : {}

type ValidInput<input> = input extends Theme.Definition
  ? input
  : input extends Theme.Tokens
    ? Parameters<typeof Theme.define<input>>[0]
    : never

type Match<input, base> = base extends
  | string
  | number
  | { light: string; dark: string }
  ? input
  : {
      [key in keyof input | keyof base]: key extends keyof input
        ? key extends keyof base
          ? key extends 'containerNames'
            ? input[key] extends readonly string[]
              ? base[key] extends readonly string[]
                ?
                    | Exclude<input[key][number], base[key][number]>
                    | Exclude<
                        base[key][number],
                        input[key][number]
                      > extends never
                  ? input[key]
                  : never
                : never
              : never
            : Match<input[key], base[key]>
          : never
        : never
    }

type Validated<options> = Record<
  Exclude<keyof options, keyof create.Options>,
  never
> &
  (options extends { shorthands: infer mappings extends Shorthands.Map }
    ? { shorthands: Shorthands.Validated<mappings> }
    : {}) &
  (options extends { theme: infer input }
    ? { theme: ValidInput<input> }
    : options extends { themes: infer catalog; defaultTheme: infer key }
      ? {
          defaultTheme: keyof catalog
          themes: {
            [name in keyof catalog]: ValidInput<catalog[name]> &
              (key extends keyof catalog
                ? catalog[name] extends Theme.Definition
                  ? Theme.Definition<
                      ExtractTokens<catalog[name]> &
                        Match<
                          ExtractTokens<catalog[name]>,
                          ExtractTokens<catalog[key]>
                        >
                    >
                  : Match<
                      ExtractTokens<catalog[name]>,
                      ExtractTokens<catalog[key]>
                    >
                : never)
          }
        }
      : {})

/** Options for a compiled root appearance initialization script. */
export type ScriptOptions = {
  /** localStorage key containing theme and colorScheme fields; defaults to zyzz. */
  readonly storageKey?: string | undefined
}
