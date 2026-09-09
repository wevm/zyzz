/**
 * Builds declaration probes from Zyzz rules for independent CSS grammar and type checks.
 * @module
 */
import * as CssTree from 'css-tree'
import * as Module from 'node:module'
import * as Literal from '../../src/internal/Literal.js'

/** One scalar declaration accepted by the public authoring boundary. */
export type Case = {
  /** Camel-case property name. */
  property: keyof typeof Literal.rules
  /** Literal value without Zyzz importance syntax. */
  value: string | number
}

/** Exhausts finite keywords and samples numeric, color, and unit boundaries. */
export function cases(): readonly Case[] {
  const output: Case[] = []
  const require = Module.createRequire(import.meta.url)
  // CSS Tree exposes units at runtime; its declaration file omits this field.
  const upstream = CssTree.lexer as CssTree.Lexer & {
    units: Record<string, readonly string[]>
  }
  const units: Record<string, unknown> = require('mdn-data/css/units.json')
  for (const [property, rule] of Object.entries(Literal.rules)) {
    const values: (string | number)[] = [
      'inherit',
      'initial',
      'revert',
      'revert-layer',
      'unset',
    ]
    if (rule.kind === 'enum') values.push(...rule.values)
    if (rule.kind === 'color')
      values.push(
        '#123',
        '#1234',
        '#123456',
        '#12345678',
        'black',
        'white',
        'transparent',
        'currentColor',
      )
    if (rule.kind === 'number') {
      values.push(rule.min, Math.max(1, rule.min))
      if (Number.isFinite(rule.max)) values.push(rule.max)
      if (!('integer' in rule)) values.push(Math.max(rule.min, 0.5))
    }
    if (rule.kind === 'length') {
      values.push(0)
      if (rule.auto) values.push('auto')
      if ('keywords' in rule) values.push(...rule.keywords)
      // The candidate vocabulary comes from upstream, not Zyzz's length-unit list.
      for (const unit of new Set([
        ...Object.keys(units),
        ...Object.values(upstream.units).flat(),
        '%',
        'Q',
      ]))
        for (const number of ['0', '1', '.5', '1e2', '-1']) {
          const value = `${number}${unit}`
          if (!Literal.validate(property as Case['property'], value))
            values.push(value)
        }
    }
    for (const value of new Set(values))
      output.push({ property: property as Case['property'], value })
  }
  return output
}

/** Uses the pinned MDN grammar, including referenced syntaxes, rather than CSS Tree's older bundled data. */
export function lexer() {
  const require = Module.createRequire(import.meta.url)
  const properties: Record<
    string,
    { syntax: string }
  > = require('mdn-data/css/properties.json')
  const syntaxes: Record<
    string,
    { syntax: string }
  > = require('mdn-data/css/syntaxes.json')
  return CssTree.fork({
    properties: Object.fromEntries(
      Object.entries(properties).map(([name, entry]) => [name, entry.syntax]),
    ),
    types: Object.fromEntries(
      Object.entries(syntaxes).map(([name, entry]) => [name, entry.syntax]),
    ),
  }).lexer
}

/** Converts public property spelling to its standard CSS name. */
export function name(property: string): string {
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

/** Independent invalid and intentionally unsupported inputs shared by runtime and type probes. */
export const rejected = [
  { property: 'alignItems', value: 'middle' },
  { property: 'color', value: 'red' },
  { property: 'color', value: 'rgb(0 0 0)' },
  { property: 'display', value: 'fleex' },
  { property: 'letterSpacing', value: '10%' },
  { property: 'margin', value: '1px 2px' },
  { property: 'padding', value: '0x10px' },
  { property: 'padding', value: '1 px' },
  { property: 'padding', value: '1qu' },
  { property: 'scrollSnapType', value: 'mandatory both' },
  { property: 'textDecorationLine', value: 'none underline' },
  { property: 'textDecorationLine', value: 'underline underline' },
  { property: 'textDecorationStyle', value: 'groove' },
  { property: 'textUnderlineOffset', value: 'from-font' },
] as const
