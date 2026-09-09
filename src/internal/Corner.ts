/**
 * Validates corner curvature keywords and numeric superellipse functions.
 * @module
 */
import * as MathExpression from './Math.js'

/** Canonical corner shapes and explicit superellipse curvature. */
export type Value = (typeof keywords)[number] | `superellipse(${string})`

/** Named curvature values from the CSS Borders grammar. */
export const keywords = [
  'bevel',
  'notch',
  'round',
  'scoop',
  'square',
  'squircle',
] as const

/** Checks one corner value without evaluating layout or painting. */
export function valid(value: string): boolean {
  if ((keywords as readonly string[]).includes(value)) return true
  const match = /^superellipse\(([\s\S]*)\)$/.exec(value)
  if (!match) return false
  const body = match[1]!.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '')
  if (body === 'infinity' || body === '-infinity') return true
  if (/^[+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(body))
    return Number.isFinite(Number(body))
  return MathExpression.valid(body, {
    kind: 'number',
    percentage: false,
    units: [],
  })
}
