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
  readonly [key in keyof typeof rules]?: Value<(typeof rules)[key]>
}
type Rule =
  | {
      readonly auto: boolean
      readonly keywords?: readonly string[]
      readonly kind: 'length'
      readonly negative: boolean
      readonly percentage?: boolean
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
      ?
          | (auto extends true ? 'auto' : never)
          | (rule extends { keywords: readonly (infer keyword)[] }
              ? keyword
              : never)
          | (rule extends { percentage: false }
              ? Exclude<Length, `${number}%`>
              : Length)
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
  values: [
    'dashed',
    'dotted',
    'double',
    'groove',
    'hidden',
    'inset',
    'none',
    'outset',
    'ridge',
    'solid',
  ],
} as const
const color = { kind: 'color' } as const
const globals = new Set<string>([
  'inherit',
  'initial',
  'revert',
  'revert-layer',
  'unset',
])
const intrinsic = ['fit-content', 'max-content', 'min-content'] as const
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
const maximum = { ...length, keywords: [...intrinsic, 'none'] } as const
const overflow = {
  kind: 'enum',
  values: ['auto', 'clip', 'hidden', 'scroll', 'visible'],
} as const
const overscroll = {
  kind: 'enum',
  values: ['auto', 'contain', 'none'],
} as const
const scrollMargin = { ...length, negative: true, percentage: false } as const
const scrollPadding = { ...length, auto: true } as const
const size = {
  auto: true,
  keywords: intrinsic,
  kind: 'length',
  negative: false,
} as const
const stroke = { ...length, percentage: false } as const
const textSpacing = {
  ...stroke,
  keywords: ['normal'],
  negative: true,
} as const

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
  borderBlockColor: color,
  borderBlockEndColor: color,
  borderBlockEndStyle: border,
  borderBlockEndWidth: stroke,
  borderBlockStartColor: color,
  borderBlockStartStyle: border,
  borderBlockStartWidth: stroke,
  borderBlockStyle: border,
  borderBlockWidth: stroke,
  borderBottomColor: color,
  borderBottomLeftRadius: length,
  borderBottomRightRadius: length,
  borderBottomStyle: border,
  borderBottomWidth: stroke,
  borderCollapse: { kind: 'enum', values: ['collapse', 'separate'] },
  borderColor: color,
  borderEndEndRadius: length,
  borderEndStartRadius: length,
  borderInlineColor: color,
  borderInlineEndColor: color,
  borderInlineEndStyle: border,
  borderInlineEndWidth: stroke,
  borderInlineStartColor: color,
  borderInlineStartStyle: border,
  borderInlineStartWidth: stroke,
  borderInlineStyle: border,
  borderInlineWidth: stroke,
  borderLeftColor: color,
  borderLeftStyle: border,
  borderLeftWidth: stroke,
  borderRadius: length,
  borderRightColor: color,
  borderRightStyle: border,
  borderRightWidth: stroke,
  borderSpacing: stroke,
  borderStartEndRadius: length,
  borderStartStartRadius: length,
  borderStyle: border,
  borderTopColor: color,
  borderTopLeftRadius: length,
  borderTopRightRadius: length,
  borderTopStyle: border,
  borderTopWidth: stroke,
  borderWidth: stroke,
  bottom: margin,
  boxSizing: { kind: 'enum', values: ['border-box', 'content-box'] },
  captionSide: { kind: 'enum', values: ['bottom', 'top'] },
  color,
  columnGap: length,
  cursor: {
    kind: 'enum',
    values: [
      'alias',
      'all-scroll',
      'auto',
      'cell',
      'col-resize',
      'context-menu',
      'copy',
      'crosshair',
      'default',
      'e-resize',
      'ew-resize',
      'grab',
      'grabbing',
      'help',
      'move',
      'n-resize',
      'ne-resize',
      'nesw-resize',
      'no-drop',
      'none',
      'not-allowed',
      'ns-resize',
      'nw-resize',
      'nwse-resize',
      'pointer',
      'progress',
      'row-resize',
      's-resize',
      'se-resize',
      'sw-resize',
      'text',
      'vertical-text',
      'w-resize',
      'wait',
      'zoom-in',
      'zoom-out',
    ],
  },
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
  emptyCells: { kind: 'enum', values: ['hide', 'show'] },
  flexBasis: { ...size, keywords: ['content', ...intrinsic] },
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
  hyphens: { kind: 'enum', values: ['auto', 'manual', 'none'] },
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
  letterSpacing: textSpacing,
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
  maxBlockSize: maximum,
  maxHeight: maximum,
  maxInlineSize: maximum,
  maxWidth: maximum,
  minBlockSize: size,
  minHeight: size,
  minInlineSize: size,
  minWidth: size,
  opacity: { kind: 'number', max: 1, min: 0 },
  // Safe integers serialize without exponential notation in CSS integer positions.
  order: {
    integer: true,
    kind: 'number',
    max: Number.MAX_SAFE_INTEGER,
    min: Number.MIN_SAFE_INTEGER,
  },
  outlineColor: color,
  outlineOffset: { ...stroke, negative: true },
  outlineStyle: {
    kind: 'enum',
    values: [
      'auto',
      'dashed',
      'dotted',
      'double',
      'groove',
      'inset',
      'none',
      'outset',
      'ridge',
      'solid',
    ],
  },
  outlineWidth: stroke,
  overflow,
  overflowWrap: { kind: 'enum', values: ['anywhere', 'break-word', 'normal'] },
  overflowX: overflow,
  overflowY: overflow,
  overscrollBehavior: overscroll,
  overscrollBehaviorX: overscroll,
  overscrollBehaviorY: overscroll,
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
  pointerEvents: { kind: 'enum', values: ['auto', 'none'] },
  position: {
    kind: 'enum',
    values: ['absolute', 'fixed', 'relative', 'static', 'sticky'],
  },
  resize: {
    kind: 'enum',
    values: ['block', 'both', 'horizontal', 'inline', 'none', 'vertical'],
  },
  right: margin,
  rowGap: length,
  scrollBehavior: { kind: 'enum', values: ['auto', 'smooth'] },
  scrollMargin,
  scrollMarginBlock: scrollMargin,
  scrollMarginBlockEnd: scrollMargin,
  scrollMarginBlockStart: scrollMargin,
  scrollMarginBottom: scrollMargin,
  scrollMarginInline: scrollMargin,
  scrollMarginInlineEnd: scrollMargin,
  scrollMarginInlineStart: scrollMargin,
  scrollMarginLeft: scrollMargin,
  scrollMarginRight: scrollMargin,
  scrollMarginTop: scrollMargin,
  scrollPadding,
  scrollPaddingBlock: scrollPadding,
  scrollPaddingBlockEnd: scrollPadding,
  scrollPaddingBlockStart: scrollPadding,
  scrollPaddingBottom: scrollPadding,
  scrollPaddingInline: scrollPadding,
  scrollPaddingInlineEnd: scrollPadding,
  scrollPaddingInlineStart: scrollPadding,
  scrollPaddingLeft: scrollPadding,
  scrollPaddingRight: scrollPadding,
  scrollPaddingTop: scrollPadding,
  scrollSnapAlign: {
    kind: 'enum',
    values: [
      'center',
      'center center',
      'center end',
      'center none',
      'center start',
      'end',
      'end center',
      'end end',
      'end none',
      'end start',
      'none',
      'none center',
      'none end',
      'none none',
      'none start',
      'start',
      'start center',
      'start end',
      'start none',
      'start start',
    ],
  },
  scrollSnapStop: { kind: 'enum', values: ['always', 'normal'] },
  scrollSnapType: {
    kind: 'enum',
    values: [
      'block',
      'block mandatory',
      'block proximity',
      'both',
      'both mandatory',
      'both proximity',
      'inline',
      'inline mandatory',
      'inline proximity',
      'none',
      'x',
      'x mandatory',
      'x proximity',
      'y',
      'y mandatory',
      'y proximity',
    ],
  },
  tableLayout: { kind: 'enum', values: ['auto', 'fixed'] },
  textAlign: {
    kind: 'enum',
    values: ['center', 'end', 'justify', 'left', 'right', 'start'],
  },
  textAlignLast: {
    kind: 'enum',
    values: ['auto', 'center', 'end', 'justify', 'left', 'right', 'start'],
  },
  textDecorationColor: color,
  textDecorationLine: {
    kind: 'enum',
    values: [
      'line-through',
      'line-through overline',
      'line-through overline underline',
      'line-through underline',
      'line-through underline overline',
      'none',
      'overline',
      'overline line-through',
      'overline line-through underline',
      'overline underline',
      'overline underline line-through',
      'underline',
      'underline line-through',
      'underline line-through overline',
      'underline overline',
      'underline overline line-through',
    ],
  },
  textDecorationSkipInk: { kind: 'enum', values: ['auto', 'none'] },
  textDecorationStyle: {
    kind: 'enum',
    values: ['dashed', 'dotted', 'double', 'solid', 'wavy'],
  },
  textDecorationThickness: { ...length, auto: true, keywords: ['from-font'] },
  textIndent: { ...length, negative: true },
  textOverflow: { kind: 'enum', values: ['clip', 'ellipsis'] },
  textTransform: {
    kind: 'enum',
    values: ['capitalize', 'lowercase', 'none', 'uppercase'],
  },
  textUnderlineOffset: { ...length, auto: true, negative: true },
  top: margin,
  userSelect: { kind: 'enum', values: ['all', 'auto', 'none', 'text'] },
  visibility: { kind: 'enum', values: ['collapse', 'hidden', 'visible'] },
  whiteSpace: {
    kind: 'enum',
    values: ['break-spaces', 'normal', 'nowrap', 'pre', 'pre-line', 'pre-wrap'],
  },
  width: size,
  wordBreak: { kind: 'enum', values: ['break-all', 'keep-all', 'normal'] },
  wordSpacing: textSpacing,
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
    return (() => {
      if (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        (!rule.integer || Number.isInteger(value)) &&
        value >= rule.min &&
        value <= rule.max
      ) {
        return undefined
      }
      return `Expected a finite ${rule.integer ? 'integer' : 'number'} from ${rule.min} to ${rule.max}.`
    })()
  if (value === 0 || (rule.auto && value === 'auto')) return undefined
  const match = typeof value === 'string' ? lengthPattern.exec(value) : null
  const amount = match ? Number(match[1]) : NaN
  if (Number.isFinite(amount) && (rule.negative || amount >= 0)) {
    // Length-only domains exclude percentages.
    if (rule.percentage !== false || match?.[2] !== '%') return undefined
  }
  if (typeof value === 'string' && rule.keywords?.includes(value))
    return undefined
  return `Expected ${rule.negative ? 'a' : 'a nonnegative'} literal length${rule.auto ? ', auto,' : ''} or numeric zero.${rule.keywords ? ` Also accepts: ${rule.keywords.join(', ')}.` : ''}`
}
