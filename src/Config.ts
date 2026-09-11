/**
 * Normalizes explicit configuration into isolated typed authoring contracts.
 * @module
 */
import type * as Binding from './internal/Binding.js'
import type * as Condition from './internal/Condition.js'
import { css, MissingTransformError } from './css.js'
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
    if (!['defaultTheme', 'layers', 'output', 'theme', 'themes'].includes(key))
      throw new InvalidError(`Unknown configuration option: ${key}`)
  if (
    input.output !== undefined &&
    input.output !== 'html' &&
    input.output !== 'react'
  )
    throw new InvalidError('output must be html or react.')
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
  const contract = Object.freeze({})
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
      script,
      theme: Token.bind(definition(input.theme), contract),
    })
  return Object.freeze({ css, script })
}

/** Configuration inputs and inferred results. */
export declare namespace create {
  /** Optional layer names and mutually exclusive theme modes. */
  type Options = {
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
    /** Generates synchronous HTML-safe root preference restoration. */
    readonly script: (options?: ScriptOptions) => string
    /** Inferred callable authoring; execution requires a source transform. */
    readonly css: Css<
      Tokens<options>,
      options extends { layers: readonly (infer name extends string)[] }
        ? name
        : never,
      options extends { output: infer output extends css.Output }
        ? output
        : 'react'
    >
  } & (options extends { theme: infer input }
    ? {
        /** Isolated single-theme contract. */ readonly theme: Theme.Definition<
          ExtractTokens<input>
        >
      }
    : options extends { themes: infer catalog }
      ? {
          /** Shared default token and variable contract. */ readonly theme: Theme.Definition<
            Tokens<options>
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
            readonly [name in keyof catalog]: Theme.Definition<
              ExtractTokens<catalog[name]>
            >
          }
        }
      : {})
}

type Css<
  tokens extends Theme.Tokens,
  layers extends string,
  output extends css.Output,
> = {
  <
    const values extends Record<string, string | number>,
    const styles extends Record<string, unknown>,
    const callback extends (...args: never[]) => unknown,
  >(
    styles: callback &
      ((
        values: values,
      ) => styles &
        NoInfer<Body<styles, tokens, layers> & Binding.Checked<styles>>) &
      (values extends Binding.Inputs<values> ? unknown : never) &
      (Parameters<callback> extends [Record<string, string | number>]
        ? unknown
        : never),
  ): css.Dynamic<values, output>
  <const styles extends Record<string, unknown>>(
    styles: styles & NoInfer<Body<styles, tokens, layers>>,
  ): css.ReturnType<output>
}
type Keys<styles> = styles extends unknown ? keyof styles : never
type Body<styles, tokens extends Theme.Tokens, layers extends string> = Record<
  Exclude<
    Keys<styles>,
    | keyof Style.DeclarationProperties
    | Condition.Keys<tokens>
    | `@layer ${layers}`
  >,
  never
> &
  (styles extends unknown
    ? {
        [key in keyof styles]: key extends
          | Condition.Keys<tokens>
          | `@layer ${layers}`
          ? styles[key] extends Record<string, unknown>
            ? Body<styles[key], tokens, layers>
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
