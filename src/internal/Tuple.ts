/**
 * Validates repeated CSS scalar components while preserving nested function boundaries.
 * @module
 */
import * as Component from './Component.js'
import * as MathExpression from './Math.js'

/** Checks scalar tuples, standalone keywords, and optional fill markers. */
export function valid(value: unknown, options: valid.Options): boolean {
  if (typeof value !== 'string' && typeof value !== 'number') return false
  const text = String(value)
  if (options.standalone?.includes(text)) return true
  const parts = Component.split(text, { separator: 'space' })
  if (!parts) return false
  const markers = parts.filter((part) => part === options.marker).length
  if (markers > 1) return false
  if (
    markers &&
    options.markerPosition === 'last' &&
    parts.at(-1) !== options.marker
  )
    return false
  const atoms = parts.filter((part) => part !== options.marker)
  if (atoms.length < options.min || atoms.length > options.max) return false
  return atoms.every((part) => {
    if (options.keywords?.includes(part)) return true
    return options.atoms.some((atom) => {
      if (atom === 'color') return options.color(part)
      if (
        /^(calc|clamp|max|min)\(/i.test(part) &&
        MathExpression.valid(part, {
          kind: atom === 'integer' ? 'number' : atom,
          percentage: atom === 'length' && options.atoms.includes('percentage'),
          units: options.units,
        })
      )
        return true
      const match =
        /^([+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)([a-zA-Z%]*)$/.exec(part)
      if (!match) return false
      const amount = Number(match[1])
      const unit = match[2]!
      if (!Number.isFinite(amount) || (!options.negative && amount < 0))
        return false
      if (atom === 'number') return unit === ''
      if (atom === 'integer')
        return (
          unit === '' && /^[+-]?\d+$/.test(part) && Number.isSafeInteger(amount)
        )
      if (atom === 'percentage') return unit === '%'
      if (atom === 'time') return unit === 's' || unit === 'ms'
      return (
        (unit === '' && amount === 0) ||
        (unit !== '%' && options.units.includes(unit))
      )
    })
  })
}

/** Numeric domains and cardinality of a repeated declaration grammar. */
export declare namespace valid {
  /** Rules supplied by the owning property map. */
  type Options = {
    /** Allowed component domains. */
    readonly atoms: readonly (
      | 'color'
      | 'integer'
      | 'length'
      | 'number'
      | 'percentage'
      | 'time'
    )[]
    /** Validates a color component independently of tuple tokenization. */
    readonly color: (value: string) => boolean
    /** Keywords allowed as individual components. */
    readonly keywords?: readonly string[]
    /** Optional marker accepted at most once. */
    readonly marker?: 'fill'
    /** Whether a marker must follow the numeric components. */
    readonly markerPosition?: 'any' | 'last'
    /** Maximum component count. */
    readonly max: number
    /** Minimum component count. */
    readonly min: 1 | 2
    /** Whether literal numeric components can be negative. */
    readonly negative: boolean
    /** Keywords that must form the entire declaration. */
    readonly standalone?: readonly string[]
    /** Recognized length units from the owning property map. */
    readonly units: readonly string[]
  }
}
