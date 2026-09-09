/**
 * Validates aspect ratios and numeric 2D/3D transforms without evaluating matrices.
 * @module
 */
import * as Component from './Component.js'
import * as MathExpression from './Math.js'

/** Canonical CSS angle shapes; argument syntax is checked during compilation. */
export type Angle = `${number}${'deg' | 'grad' | 'rad' | 'turn'}`

/** Transform function names available to the typed authoring surface. */
export type FunctionName = keyof typeof functions

/** Geometric property grammar selected by the literal rule map. */
export type Kind = 'ratio' | 'rotate' | 'scale' | 'transform' | 'translate'

type Domain =
  | 'angle'
  | 'length'
  | 'length-percentage'
  | 'number'
  | 'number-percentage'
  | 'perspective'
type FunctionRule = { readonly args: readonly Domain[]; readonly min?: number }
const functions = {
  matrix: {
    args: ['number', 'number', 'number', 'number', 'number', 'number'],
  },
  matrix3d: { args: Array.from({ length: 16 }, () => 'number' as const) },
  perspective: { args: ['perspective'] },
  rotate: { args: ['angle'] },
  rotate3d: { args: ['number', 'number', 'number', 'angle'] },
  rotateX: { args: ['angle'] },
  rotateY: { args: ['angle'] },
  rotateZ: { args: ['angle'] },
  scale: { args: ['number-percentage', 'number-percentage'], min: 1 },
  scale3d: {
    args: ['number-percentage', 'number-percentage', 'number-percentage'],
  },
  scaleX: { args: ['number-percentage'] },
  scaleY: { args: ['number-percentage'] },
  scaleZ: { args: ['number-percentage'] },
  skew: { args: ['angle', 'angle'], min: 1 },
  skewX: { args: ['angle'] },
  skewY: { args: ['angle'] },
  translate: { args: ['length-percentage', 'length-percentage'], min: 1 },
  translate3d: { args: ['length-percentage', 'length-percentage', 'length'] },
  translateX: { args: ['length-percentage'] },
  translateY: { args: ['length-percentage'] },
  translateZ: { args: ['length'] },
} as const satisfies Record<string, FunctionRule>
const byName = new Map<string, FunctionRule>(
  Object.entries(functions).map(([name, rule]) => [name.toLowerCase(), rule]),
)

/** Checks dimensions, arity, and authored function ordering while leaving evaluation to CSS. */
export function valid(value: unknown, options: valid.Options): boolean {
  if (typeof value !== 'string' && typeof value !== 'number') return false
  const text = String(value).replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '')
  if (text === 'none' && options.kind !== 'ratio') return true
  function component(value: string, domain: Domain): boolean {
    if (domain === 'perspective' && value === 'none') return true
    if (value.includes('(')) {
      const kind = (() => {
        if (domain === 'number-percentage') return 'number'
        if (domain === 'length-percentage' || domain === 'perspective')
          return 'length'
        return domain
      })()
      return (
        MathExpression.valid(value, {
          kind,
          percentage: domain === 'length-percentage',
          units: options.units,
        }) ||
        (domain === 'number-percentage' &&
          MathExpression.valid(value, {
            kind: 'percentage',
            percentage: false,
            units: options.units,
          }))
      )
    }
    const match = /^([+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)(%|[a-z]+)?$/i.exec(
      value,
    )
    if (!match || !Number.isFinite(Number(match[1]))) return false
    const number = Number(match[1])
    const unit = match[2]?.toLowerCase()
    if (domain === 'number') return !unit
    if (domain === 'number-percentage') return !unit || unit === '%'
    if (domain === 'angle')
      return (
        (!unit && number === 0) ||
        ['deg', 'grad', 'rad', 'turn'].includes(unit ?? '')
      )
    if (domain === 'perspective' && number < 0) return false
    return (
      (!unit && number === 0) ||
      (unit === '%'
        ? domain === 'length-percentage'
        : !!unit &&
          options.units.some(
            (length) => length.toLowerCase() === unit && length !== '%',
          ))
    )
  }
  if (options.kind === 'ratio') {
    if (text === 'auto') return true
    const words = Component.split(text, { separator: 'space' })
    if (!words) return false
    const values = [...words]
    if (values[0] === 'auto') values.shift()
    else if (values.at(-1) === 'auto') values.pop()
    const ratio = Component.split(values.join(' '), { separator: 'slash' })
    return (
      !!ratio &&
      ratio.length <= 2 &&
      ratio.every(
        (value) =>
          component(value, 'number') &&
          (value.includes('(') || Number(value) >= 0),
      )
    )
  }
  if (options.kind === 'transform') {
    let index = 0
    let count = 0
    while (index < text.length) {
      if (/[ \t\n\r\f]/.test(text[index]!)) {
        index++
        continue
      }
      const match = /^([a-z][a-z0-9]*)\(/i.exec(text.slice(index))
      if (!match) return false
      const rule = byName.get(match[1]!.toLowerCase())
      if (!rule) return false
      index += match[0].length
      const start = index
      let depth = 1
      while (index < text.length && depth) {
        if (text[index] === '(' && ++depth > 128) return false
        if (text[index] === ')') depth--
        index++
      }
      if (depth) return false
      const args = Component.comma(text.slice(start, index - 1))
      if (
        !args ||
        args.length < (rule.min ?? rule.args.length) ||
        args.length > rule.args.length ||
        !args.every((arg, index) => component(arg, rule.args[index]!))
      )
        return false
      count++
    }
    return count > 0
  }
  const values = Component.split(text, { separator: 'space' })
  if (!values) return false
  if (options.kind === 'scale')
    return (
      values.length <= 3 &&
      values.every((value) => component(value, 'number-percentage'))
    )
  if (options.kind === 'translate')
    return (
      values.length <= 3 &&
      values.every((value, index) =>
        component(value, index === 2 ? 'length' : 'length-percentage'),
      )
    )
  if (values.length === 1) return component(values[0]!, 'angle')
  for (const first of [false, true]) {
    const angle = first ? values[0]! : values.at(-1)!
    const axes = first ? values.slice(1) : values.slice(0, -1)
    if (
      component(angle, 'angle') &&
      ((axes.length === 1 && ['x', 'y', 'z'].includes(axes[0]!)) ||
        (axes.length === 3 &&
          axes.every((value) => component(value, 'number'))))
    )
      return true
  }
  return false
}

/** Geometric grammar and supported dimensional units. */
export declare namespace valid {
  /** Unit resolution and matrix multiplication remain browser responsibilities. */
  type Options = {
    /** Property grammar being validated. */
    readonly kind: Kind
    /** Accepted CSS length-unit vocabulary. */
    readonly units: readonly string[]
  }
}
