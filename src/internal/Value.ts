/**
 * Describes declaration fallbacks and separates importance from scalar values.
 * @module
 */
import * as Literal from './Literal.js'
import type * as Token from './Token.js'

/** Scalar declarations optionally carrying a trailing importance marker. */
export type Atom<value> =
  | value
  | (value extends string | number
      ? `${value}${'!' | ' !' | '!important' | ' !important'}`
      : never)

/** Checks inferred scalar spellings without expanding the property-value unions. */
export type Checked<style, tokens = {}> = {
  [property in keyof style]: property extends keyof Literal.Properties
    ? style[property] extends Check<
        style[property],
        Token.Names<tokens, property>
      >
      ? unknown
      : never
    : unknown
}
type Check<input, names> = input extends readonly unknown[]
  ? { [key in keyof input]: Check<input[key], names> }
  : input extends string
    ? Plain<input> extends names
      ? input
      : Literal.Checked<Plain<input>> extends never
        ? never
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

/** One declaration or a nonempty ordered sequence of declaration fallbacks. */
export type Input<value> =
  | Atom<Exclude<value, undefined>>
  | readonly [
      Atom<Exclude<value, undefined>>,
      ...Atom<Exclude<value, undefined>>[],
    ]

/** Splits a trailing importance marker without interpreting quoted or escaped text. */
export function parse(input: unknown, property: keyof Literal.Properties) {
  if (typeof input !== 'string') return undefined
  const match = /\s*!(?:important)?$/i.exec(input)
  if (!match) return undefined
  const text = input.slice(0, match.index).trimEnd()
  // Quotes and escapes belong to future CSS expression parsing, not this scalar grammar.
  if (/["'\\!]/.test(text)) return undefined
  const numeric =
    Literal.rules[property].kind === 'number' ||
    Literal.rules[property].kind === 'grid-line'
  const value =
    numeric && /^[+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(text)
      ? Number(text)
      : text
  return { important: true as const, value }
}
