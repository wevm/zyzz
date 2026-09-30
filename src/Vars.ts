/** Defines immutable variable sets and compatible scoped overrides. @module */
import type * as Typography from './internal/Typography.js'
import type * as Theme from './internal/Theme.js'
import * as Identity from './internal/Identity.js'
import type * as Literal from './internal/Literal.js'
import * as Token from './internal/Token.js'
import * as VariableSets from './internal/VariableSets.js'
import type { style } from './styleFunction.js'

export type { Composition } from './internal/Token.js'

/** Portable scalar reference retaining its value domain and optional literal precision. */
export type Reference<
  group extends Token.Group = Token.Group,
  scalar = never,
> = Token.Reference<group> &
  ([scalar] extends [never] ? {} : { readonly [Token.scalar]: scalar })

const shape = Symbol('zyzz.variables.shape')

/** A scalar, a color-scheme pair, or ordered media overrides with a required default. */
export type Value =
  | string
  | number
  | Token.Reference
  | Token.Composition
  | {
      readonly light: string | Token.Reference | Token.Composition<'color'>
      readonly dark: string | Token.Reference | Token.Composition<'color'>
    }
  | ({ readonly default: Value } & {
      readonly [query: `@media ${string}`]: Value
    })

/** Nested categories and variable paths. */
export type Values = {
  readonly [key: string]: Value | Values | readonly string[]
}

/** Immutable references retaining their shared set contract. */
export type Definition<values extends Values = Values> = (Values extends values
  ? {}
  : References<values>) & {
  /** Authored value shape retained for inference. */
  readonly [shape]: values
  /** Compiler-owned identity and values. */
  readonly [Token.definition]: Token.Metadata
}

/** Reference tree preserving the domain of each scalar leaf. */
export type References<values, root extends boolean = true> = {
  readonly [key in Exclude<
    keyof values,
    root extends true ? 'breakpoint' | 'containerNames' : never
  >]: values[key] extends Value
    ? Reference<
        Domain<Scalar<values[key]>>,
        Literal.Color extends Scalar<values[key]>
          ? never
          : Literal.Length extends Scalar<values[key]>
            ? never
            : Scalar<values[key]>
      >
    : References<values[key], false>
}

/** Resolves the scalar types represented by all conditional branches. */
export type Scalar<value> = Value extends value
  ? string | number
  : value extends Token.Composition<infer group>
    ? group extends 'color'
      ? Literal.Color
      : Literal.Length
    : value extends { readonly [Token.scalar]: infer scalar }
      ? scalar
      : value extends readonly string[]
        ? value
        : value extends Token.Reference<infer group>
          ? group extends 'color'
            ? Literal.Color
            : group extends 'spacing'
              ? Literal.Length
              : group extends 'number'
                ? number
                : string
          : value extends { default: unknown }
            ? Scalar<value[keyof value]>
            : value extends { light: infer light; dark: infer dark }
              ? Scalar<light | dark>
              : value

/** Scalar domain shared by compatible set alternatives. */
export type Domain<value> = [value] extends [Literal.Color]
  ? 'color'
  : [value] extends [Literal.Length]
    ? 'spacing'
    : [value] extends [number]
      ? 'number'
      : 'string'

/**
 * Composes immutable web CSS text and live references in a color or spacing domain.
 * @throws {InvalidError} If parts are empty, nonfinite, contain declaration markers, or include unsupported values.
 */
export function compose<group extends 'color' | 'spacing'>(
  group: group,
  parts: readonly (string | number | Reference)[],
): Token.Composition<group> {
  if (group !== 'color' && group !== 'spacing')
    throw new InvalidError(
      [],
      'Compositions require a color or spacing domain.',
    )
  if (!Array.isArray(parts) || !parts.length)
    throw new InvalidError([], 'Compositions require nonempty CSS parts.')

  const values = Array.from(parts, (part) => {
    if (Token.is(part)) return part
    if (typeof part === 'number' && Number.isFinite(part)) return String(part)
    if (typeof part === 'string' && !/[;{}!]/.test(part)) return part
    throw new InvalidError(
      [],
      'Composition parts must be CSS text, finite numbers, or variable references.',
    )
  })
  if (!values.some((part) => typeof part !== 'string' || part.trim()))
    throw new InvalidError([], 'Compositions require nonempty CSS parts.')

  return Object.freeze({
    [Token.expression]: true as const,
    group,
    parts: Object.freeze(values),
  })
}

/** Creates typed references without emitting CSS or reading the environment. */
export function define<const values extends Values>(
  values: values & NoInfer<Validated<values, false, true>>,
  options?: style.DefinitionOptions,
): Definition<values>
/** Deeply merges derived leaves, rejecting duplicate paths and leaf/category conflicts. */
export function define<
  const values extends Values,
  const derived extends Values,
>(
  values: values & NoInfer<Validated<values, false, true>>,
  derive: ((vars: References<values>) => derived) &
    NoInfer<(vars: References<values>) => Validated<derived, false, true>>,
  options?: style.DefinitionOptions,
): Definition<Merge<values, derived>>
export function define(
  values: Values,
  derive: style.DefinitionOptions | ((vars: References<Values>) => Values) = {},
  options: style.DefinitionOptions = {},
): Definition {
  if (typeof derive !== 'function') options = derive

  const contract = Object.freeze({
    variableSet: true,
    ...(options.id === undefined
      ? {}
      : {
          [Token.identity]: Identity.requireId(options.id, 'Vars.define'),
          [Token.complete]: true,
        }),
  })
  const base = VariableSets.build(values, contract)
  if (typeof derive !== 'function') return base

  const merged = VariableSets.merge(values, derive(base as References<Values>))
  return VariableSets.build(merged, contract)
}

type Merge<base, derived> = {
  readonly [key in keyof base | keyof derived]: key extends keyof derived
    ? key extends keyof base
      ? Merge<base[key], derived[key]>
      : derived[key]
    : key extends keyof base
      ? base[key]
      : never
}

/** Replaces existing leaves while preserving paths, domains, and reference identity. */
export function extend<const values extends Values>(
  variables: Definition<values>,
  overrides: Overrides<values>,
): Definition<values> {
  const metadata = Object.getOwnPropertyDescriptor(variables, Token.definition)
    ?.value as Token.Metadata | undefined
  if (!metadata?.contract.variableSet)
    throw new InvalidError([], 'Expected a variable set.')
  return VariableSets.build(
    overrides,
    metadata.contract,
    metadata.values,
    metadata.queries,
    metadata.paths,
  ) as Definition<values>
}

/** Partial compatible overrides. Conditional leaves are replaced in full. */
export type Overrides<values> = {
  readonly [key in keyof values]?: values[key] extends Value
    ? Conditional<Compatible<Scalar<values[key]>>>
    : Overrides<values[key]>
}

type Conditional<scalar> =
  | scalar
  | {
      readonly default: Conditional<scalar>
      readonly [query: `@media ${string}`]: Conditional<scalar>
    }
type Compatible<scalar> = [scalar] extends [Literal.Color]
  ?
      | Literal.Color
      | Token.Reference<'color'>
      | Token.Composition<'color'>
      | {
          readonly light:
            | Literal.Color
            | Token.Reference<'color'>
            | Token.Composition<'color'>
          readonly dark:
            | Literal.Color
            | Token.Reference<'color'>
            | Token.Composition<'color'>
        }
  : [scalar] extends [Literal.Length]
    ? Literal.Length | Token.Reference<'spacing'> | Token.Composition<'spacing'>
    : [scalar] extends [number]
      ? number | Token.Reference<'number'>
      : string | Token.Reference<'string'>

/** Category names mapped to the CSS properties that accept their shorthand tokens. */
export type Mappings = Readonly<
  Record<string, readonly (keyof Literal.Properties)[]>
>

/** Type carrier for configured shorthand lookup. */
export type Mapped<values, mappings> = (Pick<
  values,
  keyof values & ('breakpoint' | 'container' | 'containerNames' | 'typography')
> extends infer metadata extends Theme.Tokens
  ? metadata
  : {}) & {
  readonly color?: undefined
  readonly '~vars': {
    readonly values: values
    readonly mappings: mappings
  }
}

/** Reads the values declared by a reusable definition or inline set. */
export type Extract<input> = input extends { readonly [shape]: infer values }
  ? values
  : input

/** Invalid variable data with the offending path. */
export class InvalidError extends Error {
  /** Creates a diagnostic for invalid data at the supplied path. */
  constructor(
    readonly path: readonly string[],
    message: string,
  ) {
    super(`${JSON.stringify(path)}: ${message}`)
  }
  /** Stable diagnostic name. */
  override name = 'Vars.InvalidError'
}

type Validated<
  value,
  typography extends boolean = false,
  root extends boolean = false,
> = Values extends value
  ? value
  : value extends readonly string[]
    ? never
    : value extends Token.Reference | Token.Composition
      ? value
      : value extends string | number
        ? Literal.Checked<value>
        : root extends true
          ? {
              readonly [key in keyof value]: key extends 'containerNames'
                ? value[key] extends readonly string[]
                  ? value[key]
                  : never
                : key extends
                      | `${string}.${string}`
                      | `${string}!${string}`
                      | `@${string}`
                      | ''
                  ? never
                  : Validated<
                      value[key],
                      key extends 'typography' ? true : false
                    >
            }
          : value extends { default: infer base }
            ? Conditional<Compatible<Scalar<base>>> &
                Record<
                  Exclude<keyof value, 'default' | `@media ${string}`>,
                  never
                >
            : value extends { light: unknown; dark: unknown }
              ? Pair<value>
              : keyof value extends 'light' | 'dark'
                ? Pair<value>
                : {
                    readonly [key in keyof value]: key extends
                      | `${string}.${string}`
                      | `${string}!${string}`
                      | `@${string}`
                      | ''
                      ? typography extends true
                        ? key extends Typography.Condition
                          ? Validated<value[key], true>
                          : never
                        : never
                      : Validated<
                          value[key],
                          key extends 'typography' ? true : typography
                        >
                  }

/** Applies a compatible variable set and optional color scheme to a scope. */
export type Selector<
  name extends string,
  output extends style.Output = 'react',
> = {
  <
    const selection extends {
      readonly set?: name | undefined
      readonly colorScheme?: 'light' | 'dark' | 'light dark' | undefined
    } = {},
  >(
    options?: selection &
      Record<Exclude<keyof selection, 'set' | 'colorScheme'>, never>,
  ): style.Props<output>
}

type Pair<value> = {
  readonly light: Literal.Color | Token.Reference<'color'>
  readonly dark: Literal.Color | Token.Reference<'color'>
} & Record<Exclude<keyof value, 'light' | 'dark'>, never>

/** Configured references and a selector for compatible scopes. */
export type Bound<
  values extends Values,
  name extends string = never,
  output extends style.Output = 'react',
> = Definition<values> & Selector<name, output>
