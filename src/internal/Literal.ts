/**
 * Defines and validates the supported primitive CSS property and value domains.
 * @module
 */
/** Refines inferred length strings where TypeScript's number template is broader than CSS. */
export type Checked<value> = value extends Length
  ? value extends
      | `${'0x' | '0X' | '0b' | '0B' | '0o' | '0O'}${string}`
      | `${string}${' ' | '\n' | '\r' | '\t' | '\f'}${string}`
    ? never
    : value
  : value

/** Deliberately bounded color syntax; functional colors arrive with CSS parsing. */
export type Color =
  | 'black'
  | 'currentColor'
  | 'transparent'
  | 'white'
  | `#${string}`

/** CSS-wide keywords accepted by every supported property. */
export type Global = 'inherit' | 'initial' | 'revert-layer' | 'revert' | 'unset'

/** Finite CSS lengths and percentages; numeric zero needs no unit. */
export type Length = `${number}${(typeof lengthUnits)[number]}` | 0

/** Finite property surface with no arbitrary string index signature. */
export type Properties = {
  readonly [key in keyof typeof rules]?: key extends 'borderWidth'
    ? Exclude<Length, `${number}%`> | Global
    : Value<(typeof rules)[key]>
}
type Rule =
  | {
      readonly auto: boolean
      readonly kind: 'length'
      readonly negative: boolean
    }
  | {
      readonly kind: 'color'
    }
  | {
      readonly kind: 'enum'
      readonly values: readonly string[]
    }
  | {
      readonly integer?: boolean
      readonly kind: 'number'
      readonly max: number
      readonly min: number
    }
type Value<rule extends Rule> =
  | (rule extends {
      auto: infer auto
      kind: 'length'
    }
      ? (auto extends true ? 'auto' : never) | Length
      : rule extends {
            kind: 'number'
          }
        ? number
        : rule extends {
              kind: 'enum'
              values: readonly (infer value)[]
            }
          ? value
          : Color)
  | Global
const border = {
  kind: 'enum',
  values: ['dashed', 'dotted', 'double', 'hidden', 'none', 'solid'],
} as const
const color = { kind: 'color' } as const
const globals = new Set<string>([
  'inherit',
  'initial',
  'revert',
  'revert-layer',
  'unset',
])
const length = { auto: false, kind: 'length', negative: false } as const
// Keep type inference and validation on the same unit vocabulary.
const lengthUnits = [
  '%',
  'cap',
  'ch',
  'cm',
  'cqb',
  'cqh',
  'cqi',
  'cqmax',
  'cqmin',
  'cqw',
  'dvb',
  'dvh',
  'dvi',
  'dvmax',
  'dvmin',
  'dvw',
  'em',
  'ex',
  'ic',
  'in',
  'lh',
  'lvb',
  'lvh',
  'lvi',
  'lvmax',
  'lvmin',
  'lvw',
  'mm',
  'pc',
  'pt',
  'px',
  'q',
  'Q',
  'rcap',
  'rch',
  'rem',
  'rex',
  'ric',
  'rlh',
  'svb',
  'svh',
  'svi',
  'svmax',
  'svmin',
  'svw',
  'vb',
  'vh',
  'vi',
  'vmax',
  'vmin',
  'vw',
] as const
const lengthPattern = new RegExp(
  `^([+-]?(?:\\d*\\.\\d+|\\d+)(?:[eE][+-]?\\d+)?)(${lengthUnits.join('|')})$`,
)
const margin = { auto: true, kind: 'length', negative: true } as const
const overflow = {
  kind: 'enum',
  values: ['auto', 'clip', 'hidden', 'scroll', 'visible'],
} as const
const size = { auto: true, kind: 'length', negative: false } as const

/** Single source of truth for the supported literal properties and domains. */
export const rules = {
  alignContent: {
    kind: 'enum',
    values: [
      'baseline',
      'center',
      'end',
      'flex-end',
      'flex-start',
      'normal',
      'space-around',
      'space-between',
      'space-evenly',
      'start',
      'stretch',
    ],
  },
  alignItems: {
    kind: 'enum',
    values: [
      'baseline',
      'center',
      'end',
      'flex-end',
      'flex-start',
      'normal',
      'start',
      'stretch',
    ],
  },
  alignSelf: {
    kind: 'enum',
    values: [
      'auto',
      'baseline',
      'center',
      'end',
      'flex-end',
      'flex-start',
      'normal',
      'self-end',
      'self-start',
      'start',
      'stretch',
    ],
  },
  backgroundColor: color,
  blockSize: size,
  borderColor: color,
  borderRadius: length,
  borderStyle: border,
  borderWidth: length,
  bottom: margin,
  boxSizing: { kind: 'enum', values: ['border-box', 'content-box'] },
  color,
  columnGap: length,
  direction: { kind: 'enum', values: ['ltr', 'rtl'] },
  display: {
    kind: 'enum',
    values: [
      'block',
      'flex',
      'grid',
      'inline',
      'inline-block',
      'inline-flex',
      'inline-grid',
      'none',
    ],
  },
  flexBasis: size,
  flexDirection: {
    kind: 'enum',
    values: ['column', 'column-reverse', 'row', 'row-reverse'],
  },
  flexGrow: { kind: 'number', max: Infinity, min: 0 },
  flexShrink: { kind: 'number', max: Infinity, min: 0 },
  flexWrap: { kind: 'enum', values: ['nowrap', 'wrap', 'wrap-reverse'] },
  fontSize: length,
  fontStyle: { kind: 'enum', values: ['italic', 'normal', 'oblique'] },
  fontWeight: { kind: 'number', max: 1000, min: 1 },
  gap: length,
  height: size,
  inlineSize: size,
  inset: margin,
  insetBlock: margin,
  insetBlockEnd: margin,
  insetBlockStart: margin,
  insetInline: margin,
  insetInlineEnd: margin,
  insetInlineStart: margin,
  justifyContent: {
    kind: 'enum',
    values: [
      'center',
      'end',
      'flex-end',
      'flex-start',
      'normal',
      'space-around',
      'space-between',
      'space-evenly',
      'start',
    ],
  },
  left: margin,
  lineHeight: { kind: 'number', max: Infinity, min: 0 },
  margin,
  marginBlock: margin,
  marginBlockEnd: margin,
  marginBlockStart: margin,
  marginBottom: margin,
  marginInline: margin,
  marginInlineEnd: margin,
  marginInlineStart: margin,
  marginLeft: margin,
  marginRight: margin,
  marginTop: margin,
  maxBlockSize: length,
  maxHeight: { auto: false, kind: 'length', negative: false },
  maxInlineSize: length,
  maxWidth: { auto: false, kind: 'length', negative: false },
  minBlockSize: length,
  minHeight: length,
  minInlineSize: length,
  minWidth: length,
  opacity: { kind: 'number', max: 1, min: 0 },
  // Safe integers serialize without exponential notation in CSS integer positions.
  order: {
    integer: true,
    kind: 'number',
    max: Number.MAX_SAFE_INTEGER,
    min: Number.MIN_SAFE_INTEGER,
  },
  overflow,
  overflowX: overflow,
  overflowY: overflow,
  padding: length,
  paddingBlock: length,
  paddingBlockEnd: length,
  paddingBlockStart: length,
  paddingBottom: length,
  paddingInline: length,
  paddingInlineEnd: length,
  paddingInlineStart: length,
  paddingLeft: length,
  paddingRight: length,
  paddingTop: length,
  position: {
    kind: 'enum',
    values: ['absolute', 'fixed', 'relative', 'static', 'sticky'],
  },
  right: margin,
  rowGap: length,
  textAlign: {
    kind: 'enum',
    values: ['center', 'end', 'justify', 'left', 'right', 'start'],
  },
  top: margin,
  width: size,
  writingMode: {
    kind: 'enum',
    values: ['horizontal-tb', 'vertical-lr', 'vertical-rl'],
  },
} as const satisfies Record<string, Rule>

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
        ['black', 'currentColor', 'transparent', 'white'].includes(value))
      ? undefined
      : 'Expected a hex color, transparent, currentColor, black, or white.'
  if (rule.kind === 'number')
    return typeof value === 'number' &&
      Number.isFinite(value) &&
      (!rule.integer || Number.isInteger(value)) &&
      value >= rule.min &&
      value <= rule.max
      ? undefined
      : `Expected a finite ${rule.integer ? 'integer' : 'number'} from ${rule.min} to ${rule.max}.`
  if (value === 0 || (rule.auto && value === 'auto')) return undefined
  const match = typeof value === 'string' ? lengthPattern.exec(value) : null
  const amount = match ? Number(match[1]) : NaN
  if (Number.isFinite(amount) && (rule.negative || amount >= 0)) {
    // Percentages are not legal CSS border widths.
    if (property !== 'borderWidth' || match?.[2] !== '%') return undefined
  }
  return `Expected ${rule.negative ? 'a' : 'a nonnegative'} literal length${rule.auto ? ', auto,' : ''} or numeric zero.`
}
