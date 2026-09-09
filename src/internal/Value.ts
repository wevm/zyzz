/**
 * Describes declaration fallbacks and separates importance from scalar values.
 * @module
 */
import type * as Grid from './Grid.js'
import * as Literal from './Literal.js'
import type * as Token from './Token.js'

/** Scalar declarations optionally carrying a trailing importance marker. */
export type Atom<value> =
  | value
  | `${Extract<value, string | number>}${'!' | ' !' | '!important' | ' !important'}`

/** Refines concrete scalar spellings; already-broad property contracts need no literal refinement. */
export type Checked<style, tokens = {}> = {
  [property in keyof style]: Literal.Properties extends style
    ? unknown
    : property extends keyof Literal.Properties
      ? style[property] extends (property extends
          | 'gridArea'
          | 'gridColumn'
          | 'gridColumnEnd'
          | 'gridColumnStart'
          | 'gridRow'
          | 'gridRowEnd'
          | 'gridRowStart'
          ? Grid.Checked<style[property]>
          : unknown) &
          Check<
            style[property],
            Token.Names<tokens, property>,
            (typeof Literal.rules)[property]
          >
        ? unknown
        : never
      : unknown
}

type Check<input, names, rule> = input extends readonly unknown[]
  ? { [key in keyof input]: Check<input[key], names, rule> }
  : input extends names
    ? input
    : input extends string
      ? Plain<input> extends names
        ? input
        : Literal.Checked<Plain<input>> extends never
          ? never
          : Numeric<Plain<input>, rule> extends never
            ? never
            : input
      : Numeric<input, rule>

type Numeric<input, rule> = number extends input
  ? input
  : input extends number | `${number}`
    ? rule extends { integer: true }
      ? `${input}` extends `${bigint}`
        ? Range<input, rule>
        : never
      : Range<input, rule>
    : input extends `${infer amount extends number}${Literal.Unit | 'ms' | 's'}`
      ? Range<amount, rule> extends never
        ? never
        : input
      : input

type Range<input, rule> = rule extends
  | { kind: 'number' | 'percentage'; min: 0 | 1 }
  | { negative: false }
  ? input extends number | string
    ? `${input}` extends `-${string}`
      ? never
      : rule extends { kind: 'number'; min: 1 }
        ? `${input}` extends '0'
          ? never
          : input
        : input
    : input
  : input

type Plain<value extends string> = value extends
  | `${infer body}!important`
  | `${infer body}!`
  ? Trim<body>
  : value
type Trim<value extends string> =
  value extends `${infer body}${' ' | '\n' | '\r' | '\t' | '\f'}`
    ? Trim<body>
    : value

/** One atom or a nonempty ordered sequence of declaration fallback atoms. */
export type Fallbacks<atom> = atom | readonly [atom, ...atom[]]

/** One declaration or a nonempty ordered sequence of declaration fallbacks. */
export type Input<value> = Fallbacks<Atom<Exclude<value, undefined>>>

/** Splits a trailing importance marker without interpreting quoted or escaped text. */
export function parse(input: unknown, property: keyof Literal.Properties) {
  if (typeof input !== 'string') return undefined
  const match = /\s*!(?:important)?$/i.exec(input)
  if (!match) return undefined
  const text = input.slice(0, match.index).trimEnd()
  const numeric =
    Literal.rules[property]?.kind === 'number' ||
    Literal.rules[property]?.kind === 'grid-line'
  const value =
    numeric && /^[+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(text)
      ? Number(text)
      : text
  return { important: true as const, value }
}
