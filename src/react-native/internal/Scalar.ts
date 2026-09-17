/** Converts portable scalar values without source parsing or device state. @module */
import * as Color from './Color.js'

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
  if (kind === 'box' || kind === 'boxSigned') {
    const values =
      typeof value === 'string' ? value.trim().split(/\s+/) : [value]
    if (!values.length || values.length > 4)
      fail('unsupported_value', 'Use one to four scalar lengths.', path)
    for (const value of values)
      length(value, options, kind === 'boxSigned', path)
    return 0
  }
  return length(value, options, kind === 'signed' || kind === 'offset', path)
}

/** Converts a portable length to logical units. */
export function length(
  value: number | string,
  options: Options,
  signed: boolean,
  path: readonly string[],
): number {
  if (value === 0 || value === '0') return 0
  const match =
    typeof value === 'string' &&
    /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(px|rem)$/.exec(value)
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
