/**
 * Describes declaration fallbacks and separates importance from scalar values.
 * @module
 */
import type * as Grid from './Grid.js'
import * as Literal from './Literal.js'
import type * as Numeric from './Numeric.js'
import type * as Token from './Token.js'

/** Scalar declarations optionally carrying a trailing importance marker. */
export type Atom<value> =
  | value
  | `${Extract<value, string | number>}${'!' | ' !' | '!important' | ' !important'}`

/**
 * Accepts canonical and case-insensitive CSS literals without folding token names or emitted data.
 * Checks authored properties and retains validated input types to avoid expanding whole-property fallback unions.
 */
export type Accepted<style, properties> = {
  [property in keyof style]: property extends keyof properties
    ? Exclude<style[property], undefined> extends Exclude<
        properties[property],
        undefined
      >
      ? Exclude<style[property], undefined>
      : property extends keyof Literal.Properties
        ? style[property] extends string | readonly (number | string)[]
          ? Fold<style[property]> extends Input<
              | Lowercase<Extract<Literal.Properties[property], string>>
              | Extract<Literal.Properties[property], number>
            >
            ? style[property]
            : Exclude<properties[property], undefined>
          : Exclude<properties[property], undefined>
        : Exclude<properties[property], undefined>
    : never
}

type Fold<value> = value extends string
  ? Lowercase<Normalized<value>>
  : value extends readonly unknown[]
    ? { [key in keyof value]: Fold<value[key]> }
    : value

/** Refines concrete scalar spellings; already-broad property contracts need no literal refinement. */
export type Checked<style, tokens = {}> = {
  [property in keyof style]: Literal.Properties extends style
    ? unknown
    : property extends keyof typeof Literal.rules
      ? style[property] extends (property extends
          | 'gridArea'
          | 'gridColumn'
          | 'gridColumnEnd'
          | 'gridColumnStart'
          | 'gridRow'
          | 'gridRowEnd'
          | 'gridRowStart'
          ? Fold<style[property]> extends Grid.Checked<Fold<style[property]>>
            ? unknown
            : never
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
        : Literal.Checked<Lowercase<Plain<Normalized<input>>>> extends never
          ? never
          : Scalar<Lowercase<Plain<Normalized<input>>>, rule> extends never
            ? never
            : input
      : Scalar<input, rule>

type Scalar<input, rule> = number extends input
  ? input
  : input extends number | `${number}`
    ? Numeric.Checked<
        input,
        rule extends { integer: true } ? true : false
      > extends never
      ? never
      : Range<input, rule>
    : input extends `${infer amount}${Literal.Unit | 'ms' | 's'}`
      ? Range<amount, rule> extends never
        ? never
        : input
      : input

type Range<input, rule> = rule extends
  | { kind: 'number' | 'percentage'; min: 0 | 1 }
  | { negative: false }
  ? input extends number | string
    ? `${input}` extends `-${string}`
      ? Numeric.Zero<input> extends true
        ? rule extends { kind: 'number'; min: 1 }
          ? never
          : input
        : never
      : rule extends { kind: 'number'; min: 1 }
        ? Numeric.Zero<input> extends true
          ? never
          : input
        : input
    : input
  : input

type Normalized<value extends string> =
  TrimStart<Trim<value>> extends infer text extends string
    ? text extends `${infer body}!${infer suffix}`
      ? Lowercase<TrimStart<Trim<suffix>>> extends '' | 'important'
        ? `${Trim<body>}!important`
        : `${body}!${Normalized<suffix>}`
      : text
    : never
type TrimStart<value extends string> =
  value extends `${' ' | '\n' | '\r' | '\t' | '\f'}${infer body}`
    ? TrimStart<body>
    : value

type Plain<value extends string> = value extends `${infer body}!${infer suffix}`
  ? Lowercase<suffix> extends '' | 'important'
    ? Trim<body>
    : `${body}!${Plain<suffix>}`
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
  const match = /!(?:[ \t\n\r\f]*important)?[ \t\n\r\f]*$/i.exec(input)
  if (!match) return undefined
  const valueText = input
  function escaped(index: number): boolean {
    let count = 0
    while (index > 0 && valueText[index - 1] === '\\') {
      count++
      index--
    }
    return count % 2 === 1
  }
  if (escaped(match.index)) return undefined
  let end = match.index
  while (end > 0 && /[ \t\n\r\f]/.test(input[end - 1]!) && !escaped(end - 1))
    end--
  const text = input.slice(0, end)
  const numeric =
    Literal.rule(property)?.kind === 'number' ||
    Literal.rule(property)?.kind === 'grid-line'
  const value =
    numeric && /^[+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(text)
      ? Number(text)
      : text
  return { important: true as const, value }
}
