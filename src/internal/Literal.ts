/** CSS-wide keywords accepted by every supported property. */
export type Global = 'inherit' | 'initial' | 'revert' | 'revert-layer' | 'unset'
/** Length units supported by the initial literal contract. */
export type Length = 0 | `${number}${'px' | 'rem' | 'em' | 'vh' | 'vw' | '%'}`
/** Deliberately bounded color syntax; functional colors arrive with CSS parsing. */
export type Color =
  | `#${string}`
  | 'transparent'
  | 'currentColor'
  | 'black'
  | 'white'

type Rule =
  | {
      readonly kind: 'length'
      readonly negative: boolean
      readonly auto: boolean
    }
  | { readonly kind: 'number'; readonly min: number; readonly max: number }
  | { readonly kind: 'enum'; readonly values: readonly string[] }
  | { readonly kind: 'color' }

const length = { kind: 'length', negative: false, auto: false } as const
const margin = { kind: 'length', negative: true, auto: true } as const
const size = { kind: 'length', negative: false, auto: true } as const
const color = { kind: 'color' } as const
const border = {
  kind: 'enum',
  values: ['none', 'hidden', 'solid', 'dashed', 'dotted', 'double'],
} as const

/** Single source of truth for the supported literal properties and domains. */
export const rules = {
  display: {
    kind: 'enum',
    values: [
      'none',
      'block',
      'inline',
      'inline-block',
      'flex',
      'inline-flex',
      'grid',
      'inline-grid',
    ],
  },
  position: {
    kind: 'enum',
    values: ['static', 'relative', 'absolute', 'fixed', 'sticky'],
  },
  boxSizing: { kind: 'enum', values: ['border-box', 'content-box'] },
  flexDirection: {
    kind: 'enum',
    values: ['row', 'row-reverse', 'column', 'column-reverse'],
  },
  flexWrap: { kind: 'enum', values: ['nowrap', 'wrap', 'wrap-reverse'] },
  alignItems: {
    kind: 'enum',
    values: [
      'normal',
      'stretch',
      'start',
      'end',
      'center',
      'flex-start',
      'flex-end',
      'baseline',
    ],
  },
  justifyContent: {
    kind: 'enum',
    values: [
      'normal',
      'start',
      'end',
      'center',
      'flex-start',
      'flex-end',
      'space-between',
      'space-around',
      'space-evenly',
    ],
  },
  gap: length,
  rowGap: length,
  columnGap: length,
  padding: length,
  paddingTop: length,
  paddingRight: length,
  paddingBottom: length,
  paddingLeft: length,
  margin,
  marginTop: margin,
  marginRight: margin,
  marginBottom: margin,
  marginLeft: margin,
  width: size,
  height: size,
  minWidth: length,
  minHeight: length,
  maxWidth: { kind: 'length', negative: false, auto: false },
  maxHeight: { kind: 'length', negative: false, auto: false },
  color,
  backgroundColor: color,
  borderColor: color,
  borderWidth: length,
  borderStyle: border,
  borderRadius: length,
  fontSize: length,
  fontWeight: { kind: 'number', min: 1, max: 1000 },
  lineHeight: { kind: 'number', min: 0, max: Infinity },
  opacity: { kind: 'number', min: 0, max: 1 },
  flexGrow: { kind: 'number', min: 0, max: Infinity },
  flexShrink: { kind: 'number', min: 0, max: Infinity },
  textAlign: {
    kind: 'enum',
    values: ['start', 'end', 'left', 'right', 'center', 'justify'],
  },
  fontStyle: { kind: 'enum', values: ['normal', 'italic', 'oblique'] },
} as const satisfies Record<string, Rule>

type Value<rule extends Rule> =
  | Global
  | (rule extends { kind: 'length'; auto: infer auto }
      ? Length | (auto extends true ? 'auto' : never)
      : rule extends { kind: 'number' }
        ? number
        : rule extends { kind: 'enum'; values: readonly (infer value)[] }
          ? value
          : Color)

/** Finite property surface with no arbitrary string index signature. */
export type Properties = {
  readonly [key in keyof typeof rules]?: key extends 'borderWidth'
    ? Global | Exclude<Length, `${number}%`>
    : Value<(typeof rules)[key]>
}

const globals = new Set<string>([
  'inherit',
  'initial',
  'revert',
  'revert-layer',
  'unset',
])
const lengthPattern =
  /^([+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)(px|rem|em|vh|vw|%)$/

/** Returns a domain explanation when a literal is unsupported. */
export function validate(
  property: keyof typeof rules,
  value: unknown,
): string | undefined {
  const rule: Rule = rules[property]
  if (typeof value === 'string' && globals.has(value)) return undefined
  if (rule.kind === 'enum')
    return typeof value === 'string' && rule.values.includes(value)
      ? undefined
      : `Expected one of: ${rule.values.join(', ')} (or a CSS-wide keyword).`
  if (rule.kind === 'color')
    return typeof value === 'string' &&
      (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value) ||
        ['transparent', 'currentColor', 'black', 'white'].includes(value))
      ? undefined
      : 'Expected a hex color, transparent, currentColor, black, or white.'
  if (rule.kind === 'number')
    return typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= rule.min &&
      value <= rule.max
      ? undefined
      : `Expected a finite number from ${rule.min} to ${rule.max}.`
  if (value === 0 || (rule.auto && value === 'auto')) return undefined
  const match = typeof value === 'string' ? lengthPattern.exec(value) : null
  const amount = match ? Number(match[1]) : NaN
  if (Number.isFinite(amount) && (rule.negative || amount >= 0)) {
    // Percentages are not legal CSS border widths.
    if (property !== 'borderWidth' || match?.[2] !== '%') return undefined
  }
  return `Expected ${rule.negative ? 'a' : 'a nonnegative'} literal length${rule.auto ? ', auto,' : ''} or numeric zero.`
}
