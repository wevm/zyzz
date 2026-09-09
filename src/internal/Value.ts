/**
 * Describes declaration fallbacks and separates importance from scalar values.
 * @module
 */
import * as Literal from './Literal.js'

/** Scalar declarations optionally carrying a trailing importance marker. */
export type Atom<value> =
  | value
  | (value extends string | number
      ? `${value}${'!' | ' !' | '!important' | ' !important'}`
      : never)

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
  const numeric = Literal.rules[property].kind === 'number'
  const value =
    (numeric || text === '0') &&
    /^[+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(text)
      ? Number(text)
      : text
  return { important: true as const, value }
}
