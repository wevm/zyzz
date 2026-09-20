/** Defines immutable variable sets and compatible scoped overrides. @module */
import * as Identity from './internal/Identity.js'
import type * as Literal from './internal/Literal.js'
import * as Token from './internal/Token.js'
import * as VariableSets from './internal/VariableSets.js'
import type { style } from './styleFunction.js'

const shape = Symbol('zyzz.variables.shape')

/** A scalar, a color-scheme pair, or ordered media overrides with a required default. */
export type Value =
  | string
  | number
  | Token.Reference
  | {
      readonly light: string | Token.Reference
      readonly dark: string | Token.Reference
    }
  | ({ readonly default: Value } & {
      readonly [query: `@media ${string}`]: Value
    })

/** Nested categories and variable paths. */
export type Values = { readonly [key: string]: Value | Values }

/** Immutable references retaining their shared set contract. */
export type Definition<values extends Values = Values> = References<values> & {
  /** Authored value shape retained for inference. */
  readonly [shape]: values
  /** Compiler-owned identity and values. */
  readonly [Token.definition]: Token.Metadata
}

/** Reference tree preserving the domain of each scalar leaf. */
export type References<values> = {
  readonly [key in keyof values]: values[key] extends Value
    ? Token.Reference<Domain<Scalar<values[key]>>> & {
        readonly [Token.scalar]: Scalar<values[key]>
      }
    : References<values[key]>
}

/** Resolves the scalar types represented by all conditional branches. */
export type Scalar<value> = Value extends value
  ? string | number
  : value extends { readonly [Token.scalar]: infer scalar }
    ? scalar
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

/** Creates typed references without emitting CSS or reading the environment. */
export function define<const values extends Values>(
  values: values & NoInfer<Validated<values>>,
  options: style.DefinitionOptions = {},
): Definition<values> {
  const contract = Object.freeze({
    variableSet: true,
    ...(options.id === undefined
      ? {}
      : {
          [Token.identity]: Identity.requireId(options.id, 'Variables.define'),
          [Token.complete]: true,
        }),
  })
  return VariableSets.build(values, contract) as Definition<values>
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
      | {
          readonly light: Literal.Color | Token.Reference<'color'>
          readonly dark: Literal.Color | Token.Reference<'color'>
        }
  : [scalar] extends [Literal.Length]
    ? Literal.Length | Token.Reference<'spacing'>
    : [scalar] extends [number]
      ? number | Token.Reference<'number'>
      : string | Token.Reference<'string'>

/** Category names mapped to the CSS properties that accept their shorthand tokens. */
export type Mappings = Readonly<
  Record<string, readonly (keyof Literal.Properties)[]>
>

/** Type carrier for configured shorthand lookup. */
export type Mapped<values, mappings> = {
  readonly color?: undefined
  readonly [Token.mapping]: {
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
  override name = 'Variables.InvalidError'
}

type Validated<value> = Values extends value
  ? value
  : value extends Token.Reference
    ? value
    : value extends string | number
      ? Literal.Checked<value>
      : value extends { default: infer base }
        ? Conditional<Compatible<Scalar<base>>> &
            Record<Exclude<keyof value, 'default' | `@media ${string}`>, never>
        : value extends { light: unknown } | { dark: unknown }
          ? {
              readonly light: Literal.Color | Token.Reference<'color'>
              readonly dark: Literal.Color | Token.Reference<'color'>
            } & Record<Exclude<keyof value, 'light' | 'dark'>, never>
          : {
              readonly [key in keyof value]: key extends
                | `${string}.${string}`
                | `${string}!${string}`
                | `@${string}`
                | ''
                ? never
                : Validated<value[key]>
            }
