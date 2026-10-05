/** Converts portable scalar values without source parsing or device state. @module */
import * as Color from './Color.js'
import * as Calculation from './Calculation.js'

/** Portable property domains shared by static and dynamic native conversion. */
export const properties = {
  alignContent: [
    'center',
    'flex-end',
    'flex-start',
    'space-around',
    'space-between',
    'space-evenly',
    'stretch',
  ],
  alignItems: ['baseline', 'center', 'flex-end', 'flex-start', 'stretch'],
  alignSelf: [
    'auto',
    'baseline',
    'center',
    'flex-end',
    'flex-start',
    'stretch',
  ],
  aspectRatio: 'ratio',
  backfaceVisibility: ['hidden', 'visible'],
  backgroundColor: 'color',
  borderBottomColor: 'color',
  borderBottomLeftRadius: 'length',
  borderBottomRightRadius: 'length',
  borderBottomWidth: 'length',
  borderColor: 'color',
  borderLeftColor: 'color',
  borderLeftWidth: 'length',
  borderRadius: 'length',
  borderRightColor: 'color',
  borderRightWidth: 'length',
  borderStyle: ['dashed', 'dotted', 'solid'],
  borderTopColor: 'color',
  borderTopLeftRadius: 'length',
  borderTopRightRadius: 'length',
  borderTopWidth: 'length',
  borderWidth: 'length',
  bottom: 'offset',
  boxSizing: ['border-box', 'content-box'],
  boxShadow: 'shadow',
  color: 'color',
  columnGap: 'length',
  direction: ['ltr', 'rtl'],
  display: ['contents', 'flex', 'none'],
  flex: 'flex',
  flexBasis: 'size',
  flexDirection: ['column', 'column-reverse', 'row', 'row-reverse'],
  flexGrow: 'number',
  flexShrink: 'number',
  flexWrap: ['nowrap', 'wrap', 'wrap-reverse'],
  fontFamily: 'font',
  fontSize: 'length',
  fontStyle: ['italic', 'normal'],
  fontVariant: 'fontVariant',
  fontWeight: 'weight',
  gap: 'length',
  height: 'size',
  inset: 'boxOffset',
  justifyContent: [
    'center',
    'flex-end',
    'flex-start',
    'space-around',
    'space-between',
    'space-evenly',
  ],
  left: 'offset',
  letterSpacing: 'signed',
  lineHeight: 'line',
  margin: 'boxSigned',
  marginBottom: 'signed',
  marginLeft: 'signed',
  marginRight: 'signed',
  marginTop: 'signed',
  maxHeight: 'dimension',
  maxWidth: 'dimension',
  minHeight: 'dimension',
  minWidth: 'dimension',
  objectFit: ['contain', 'cover', 'fill', 'none', 'scale-down'],
  opacity: 'opacity',
  overflow: ['hidden', 'visible'],
  padding: 'box',
  paddingBottom: 'length',
  paddingLeft: 'length',
  paddingRight: 'length',
  paddingTop: 'length',
  position: ['absolute', 'relative', 'static'],
  right: 'offset',
  rowGap: 'length',
  textAlign: ['center', 'end', 'justify', 'left', 'right', 'start'],
  textDecorationColor: 'color',
  textDecorationLine: [
    'line-through',
    'line-through underline',
    'none',
    'underline',
    'underline line-through',
  ],
  textDecorationStyle: ['dashed', 'dotted', 'double', 'solid', 'wavy'],
  textShadow: 'textShadow',
  textTransform: ['capitalize', 'lowercase', 'none', 'uppercase'],
  top: 'offset',
  transform: 'transform',
  transformOrigin: 'origin',
  userSelect: ['all', 'auto', 'none', 'text'],
  width: 'size',
  zIndex: 'integer',
} as const

/** Explicit portable-unit and font mappings. */
export type Options = {
  /** Authored family names mapped to native font names. */
  readonly fonts?: Readonly<Record<string, string>> | undefined
  /** Explicit logical-unit scales. */
  readonly units?:
    | { readonly px?: number | undefined; readonly rem?: number | undefined }
    | undefined
}

/** Converts a validated property domain using explicit unit and font mappings. */
export function convert(
  kind: (typeof properties)[keyof typeof properties],
  value: number | string,
  options: Options,
  path: readonly string[],
): number | string {
  if (Array.isArray(kind)) {
    if (typeof value !== 'string' || !kind.includes(value))
      fail('unsupported_value', 'Unsupported native keyword.', path)
    return value === 'line-through underline' ? 'underline line-through' : value
  }
  if (kind === 'ratio') {
    const match =
      typeof value === 'string'
        ? /^\s*(\d+(?:\.\d+)?|\.\d+)\s*\/\s*(\d+(?:\.\d+)?|\.\d+)\s*$/.exec(
            value,
          )
        : undefined
    const ratio =
      typeof value === 'number'
        ? value
        : match
          ? Number(match[1]) / Number(match[2] ?? 1)
          : NaN
    if (!Number.isFinite(ratio) || ratio <= 0)
      fail('unsupported_value', 'Use a positive finite aspect ratio.', path)
    return ratio
  }
  if (kind === 'color') {
    const converted = typeof value === 'string' ? Color.parse(value) : undefined
    if (converted === undefined)
      fail(
        'unsupported_value',
        'Use an absolute sRGB color supported by native conversion.',
        path,
      )
    return converted
  }
  if (kind === 'font') {
    if (typeof value !== 'string' || !Object.hasOwn(options.fonts ?? {}, value))
      fail(
        'unsupported_value',
        'Provide an explicit fonts mapping for this family.',
        path,
      )
    return options.fonts![value]!
  }
  if (kind === 'weight') {
    if (
      value === 'normal' ||
      value === 'bold' ||
      (typeof value === 'number' &&
        value >= 100 &&
        value <= 900 &&
        value % 100 === 0)
    )
      return value
    fail(
      'unsupported_value',
      'Use normal, bold, or numeric weights 100 through 900 in steps of 100.',
      path,
    )
  }
  if (kind === 'number' || kind === 'integer' || kind === 'opacity') {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      (kind === 'integer' ? !Number.isInteger(value) : value < 0) ||
      (kind === 'opacity' && value > 1)
    )
      fail('unsupported_value', 'Unsupported native numeric value.', path)
    return value
  }
  if (kind === 'size' && value === 'auto') return value
  if (
    (kind === 'dimension' || kind === 'size' || kind === 'offset') &&
    typeof value === 'string' &&
    /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)%$/.test(value)
  ) {
    const number = Number(value.slice(0, -1))
    if (Number.isFinite(number) && (kind === 'offset' || number >= 0))
      return value
    fail('unsupported_value', 'Invalid native percentage.', path)
  }
  if (kind === 'flex') {
    flex(value, options, path)
    return 0
  }
  if (kind === 'box' || kind === 'boxOffset' || kind === 'boxSigned') {
    const values =
      typeof value === 'string' ? Calculation.parts(value) : [value]
    if (!values.length || values.length > 4)
      fail('unsupported_value', 'Use one to four scalar lengths.', path)
    for (const value of values)
      if (kind === 'boxOffset') convert('offset', value, options, path)
      else length(value, options, kind === 'boxSigned', path)
    return 0
  }
  return length(value, options, kind === 'signed' || kind === 'offset', path)
}

/**
 * Expands the CSS `flex` shorthand to native longhands with CSS semantics.
 * Omitted factors default to 1 and an omitted basis to 0, unlike the React Native `flex` prop.
 */
export function flex(
  value: number | string,
  options: Options,
  path: readonly string[],
): flex.ReturnType {
  const keyword = typeof value === 'string' ? value.trim() : undefined
  if (keyword === 'none')
    return { flexBasis: 'auto', flexGrow: 0, flexShrink: 0 }
  if (keyword === 'auto')
    return { flexBasis: 'auto', flexGrow: 1, flexShrink: 1 }
  if (keyword === 'initial')
    return { flexBasis: 'auto', flexGrow: 0, flexShrink: 1 }

  const parts = typeof value === 'string' ? Calculation.parts(value) : [value]
  const kinds: ('basis' | 'factor')[] = []
  for (const part of parts) {
    const numeric =
      typeof part === 'number' ||
      /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(part)
    // A unitless zero after two factors is the basis, as in CSS.
    const basis =
      !numeric || (kinds.join(' ') === 'factor factor' && Number(part) === 0)
    kinds.push(basis ? 'basis' : 'factor')
  }
  // Factors stay adjacent, and the basis may precede or follow them.
  if (
    ![
      'basis',
      'basis factor',
      'basis factor factor',
      'factor',
      'factor basis',
      'factor factor',
      'factor factor basis',
    ].includes(kinds.join(' '))
  )
    fail('unsupported_value', 'Invalid flex shorthand.', path)

  const factors = parts
    .filter((_, index) => kinds[index] === 'factor')
    .map((part) => convert('number', Number(part), options, path) as number)
  const basis = parts.find((_, index) => kinds[index] === 'basis')

  return {
    flexBasis: basis === undefined ? 0 : convert('size', basis, options, path),
    flexGrow: factors[0] ?? 1,
    flexShrink: factors[1] ?? 1,
  }
}

/** Native longhands produced by the `flex` shorthand. */
export declare namespace flex {
  /** Grow and shrink factors with a converted basis. */
  type ReturnType = {
    readonly flexBasis: number | string
    readonly flexGrow: number
    readonly flexShrink: number
  }
}

/** Converts a portable length to logical units. */
export function length(
  value: number | string,
  options: Options,
  signed: boolean,
  path: readonly string[],
): number {
  if (value === 0 || value === '0') return 0
  if (typeof value === 'string' && /^\s*calc\(/i.test(value)) {
    const result = Calculation.length(value.trim(), options)
    if (!signed && result < 0)
      fail(
        'unsupported_value',
        'Converted length is outside the native property domain.',
        path,
      )
    return result
  }
  const match =
    typeof value === 'string' &&
    /^([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)(px|rem)$/.exec(value)
  if (!match)
    fail(
      'unsupported_value',
      'Use zero, px, or rem with an explicit rem conversion.',
      path,
    )
  const scale =
    match[2] === 'px' ? (options.units?.px ?? 1) : options.units?.rem
  if (scale === undefined)
    fail('unsupported_value', 'Provide units.rem for rem lengths.', path)
  const result = Number(match[1]) * scale
  if (!Number.isFinite(result) || (!signed && result < 0))
    fail(
      'unsupported_value',
      'Converted length is outside the native property domain.',
      path,
    )
  return result
}

function fail(_code: string, message: string, _path: readonly string[]): never {
  throw new Error(message)
}
