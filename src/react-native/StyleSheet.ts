/** Compiles portable declarations into immutable native theme tables. @module */
import type * as Style from '../Style.js'
import type * as Theme from '../Theme.js'
import * as Token from '../internal/Token.js'

const properties = {
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
    'none',
    'underline',
    'underline line-through',
  ],
  textDecorationStyle: ['dashed', 'dotted', 'double', 'solid', 'wavy'],
  textTransform: ['capitalize', 'lowercase', 'none', 'uppercase'],
  top: 'offset',
  userSelect: ['all', 'auto', 'contain', 'none', 'text'],
  width: 'size',
  zIndex: 'integer',
} as const

const colors = [
  'aqua',
  'black',
  'blue',
  'fuchsia',
  'gray',
  'green',
  'lime',
  'maroon',
  'navy',
  'olive',
  'purple',
  'red',
  'silver',
  'teal',
  'transparent',
  'white',
  'yellow',
] as const

/** Frozen native overlay style with zero physical offsets. */
export const absoluteFill = Object.freeze({
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
} as const)

/** Explicit theme alternative, never inferred from a device. */
export type ColorScheme = 'dark' | 'light'

/** Failure to represent the supplied definitions on the native target. */
export class CompileError extends Error {
  /** Copies and freezes diagnostic paths in authored order. */
  constructor(diagnostics: readonly Diagnostic[]) {
    super(
      diagnostics
        .map(({ message, path }) => `${JSON.stringify(path)}: ${message}`)
        .join('\n'),
    )
    this.diagnostics = Object.freeze(
      diagnostics.map((diagnostic) =>
        Object.freeze({
          ...diagnostic,
          path: Object.freeze([...diagnostic.path]),
        }),
      ),
    )
  }
  /** Target capability failures, including the selected table when relevant. */
  readonly diagnostics: readonly Diagnostic[]
  /** Stable namespaced error identifier. */
  override name = 'StyleSheet.CompileError'
}

/**
 * Resolves portable tokens into two static scheme tables per supplied theme.
 * px defaults to one native logical unit. rem and font families require mappings.
 * No device state, CSS parser, stylesheet registration, or runtime binding is used.
 * @throws {CompileError} For unsupported semantics or invalid conversion inputs.
 */
export function compile<
  const name extends string,
  const themeName extends string = 'default',
>(
  options: compile.Options<name, themeName>,
): compile.ReturnType<name, themeName> {
  for (const key of Object.keys(options))
    if (!['fonts', 'styles', 'themes', 'units'].includes(key))
      fail('invalid_options', 'Unknown native compiler option.', [key])

  for (const [unit, scale] of Object.entries(options.units ?? {}))
    if (
      !['px', 'rem'].includes(unit) ||
      (scale !== undefined &&
        (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0))
    )
      fail(
        'invalid_options',
        'Unit scales must be positive finite px or rem conversions.',
        ['units', unit],
      )

  for (const [family, mapped] of Object.entries(options.fonts ?? {}))
    if (!family || typeof mapped !== 'string' || !mapped.trim())
      fail('invalid_options', 'Font mappings require nonempty family names.', [
        'fonts',
        family,
      ])

  if (!options.styles || !Array.isArray(options.styles.styles))
    fail('invalid_options', 'Expected a Style.define result.', ['styles'])

  const names = new Set<string>()
  for (const style of options.styles.styles) {
    if (!style.name || names.has(style.name))
      fail('invalid_options', 'Style names must be nonempty and unique.', [
        style.name,
      ])
    names.add(style.name)
    if (style.rules?.length)
      fail(
        'unsupported_feature',
        'Selectors, queries, and nested rules are not supported on native.',
        [style.name],
      )

    const declared = new Set<string>()
    for (const declaration of style.declarations) {
      const path = [style.name, declaration.property]
      if (!Object.hasOwn(properties, declaration.property))
        fail(
          'unsupported_feature',
          'Property is outside the native subset.',
          path,
        )
      if (declaration.important || declared.has(declaration.property))
        fail(
          'unsupported_feature',
          'Importance and fallback declarations are not supported on native.',
          path,
        )
      declared.add(declaration.property)
    }
  }

  const themes: readonly (readonly [string, Theme.Definition | undefined])[] =
    options.themes === undefined
      ? [['default', undefined]]
      : Object.entries(options.themes)
  if (!themes.length)
    fail(
      'invalid_options',
      'Supply at least one theme, or omit themes for a default table.',
      ['themes'],
    )

  const tables: Record<
    string,
    Readonly<Record<ColorScheme, Readonly<Record<string, NativeStyle>>>>
  > = Object.create(null)
  const interned = new Map<string, NativeStyle>()
  const diagnostics: Diagnostic[] = []

  for (const [label, theme] of themes) {
    if (!label)
      fail('invalid_options', 'Theme labels must be nonempty.', [
        'themes',
        label,
      ])
    const metadata =
      theme &&
      (Object.getOwnPropertyDescriptor(theme, Token.definition)?.value as
        | Token.Metadata
        | undefined)
    if (options.themes !== undefined && !metadata)
      fail(
        'invalid_options',
        'Expected a Theme.define or Config theme handle.',
        ['themes', label],
      )

    const schemes = {} as Record<
      ColorScheme,
      Readonly<Record<string, NativeStyle>>
    >
    for (const scheme of ['light', 'dark'] as const) {
      const compiled: Record<string, NativeStyle> = Object.create(null)
      for (const style of options.styles.styles) {
        const output: Record<string, number | string> = {}
        let lineHeight: number | string | undefined
        for (const declaration of style.declarations) {
          const property = declaration.property as keyof typeof properties
          const path = [label, scheme, style.name, property]
          try {
            const value = resolve(declaration.value, metadata, scheme, path)
            if (property === 'lineHeight') {
              lineHeight = value
              continue
            }
            const kind = properties[property]
            const converted = convert(kind, value, options, path)
            if (property === 'padding' || property === 'margin') {
              const values =
                typeof value === 'string' ? value.trim().split(/\s+/) : [value]
              const [top, right = top, bottom = top, left = right] = values.map(
                (value) => length(value, options, property === 'margin', path),
              )
              output[`${property}Top`] = top!
              output[`${property}Right`] = right!
              output[`${property}Bottom`] = bottom!
              output[`${property}Left`] = left!
            } else if (
              property === 'borderColor' ||
              property === 'borderWidth'
            ) {
              for (const side of ['Top', 'Right', 'Bottom', 'Left'])
                output[
                  `border${side}${property === 'borderColor' ? 'Color' : 'Width'}`
                ] = converted
            } else if (property === 'borderRadius') {
              for (const corner of [
                'TopLeft',
                'TopRight',
                'BottomRight',
                'BottomLeft',
              ])
                output[`border${corner}Radius`] = converted
            } else if (property === 'gap') {
              output.columnGap = converted
              output.rowGap = converted
            } else output[property] = converted
          } catch (error) {
            if (!(error instanceof CompileError)) throw error
            diagnostics.push(...error.diagnostics)
          }
        }
        if (lineHeight !== undefined) {
          const path = [label, scheme, style.name, 'lineHeight']
          try {
            if (typeof lineHeight === 'number') {
              if (
                !Number.isFinite(lineHeight) ||
                lineHeight < 0 ||
                typeof output.fontSize !== 'number'
              )
                fail(
                  'unsupported_value',
                  'Numeric lineHeight requires an explicit fontSize in the same style.',
                  path,
                )
              output.lineHeight = lineHeight * output.fontSize
              if (!Number.isFinite(output.lineHeight))
                fail(
                  'unsupported_value',
                  'Converted lineHeight must be finite.',
                  path,
                )
            } else output.lineHeight = length(lineHeight, options, false, path)
          } catch (error) {
            if (!(error instanceof CompileError)) throw error
            diagnostics.push(...error.diagnostics)
          }
        }
        const key = JSON.stringify(
          Object.entries(output).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
        let shared = interned.get(key)
        if (!shared) {
          shared = Object.freeze(output) as NativeStyle
          interned.set(key, shared)
        }
        compiled[style.name] = shared
      }
      schemes[scheme] = Object.freeze(compiled)
    }
    tables[label] = Object.freeze(schemes)
  }
  if (diagnostics.length) throw new CompileError(diagnostics)
  return Object.freeze({
    styles: Object.freeze(tables) as Tables<name, themeName>,
  })
}

/** Native compilation options and results. */
export declare namespace compile {
  /** Caller-owned mappings and portable definitions. */
  type Options<
    name extends string = string,
    themeName extends string = string,
  > = {
    /** Exact authored font-family text mapped to an installed native family. */
    readonly fonts?: Readonly<Record<string, string>> | undefined
    /** Immutable shared definitions, also accepted by Css.compile. */
    readonly styles: Style.Definition<name>
    /** Explicit output labels. Omission creates the token-fallback default table. */
    readonly themes?: Readonly<Record<themeName, Theme.Definition>> | undefined
    /** Positive logical-unit scales. px defaults to one, rem has no default. */
    readonly units?:
      | { readonly px?: number | undefined; readonly rem?: number | undefined }
      | undefined
  }
  /** Complete immutable light/dark tables with inferred labels and style names. */
  type ReturnType<
    name extends string = string,
    themeName extends string = string,
  > = {
    /** Precompiled tables, suitable for identity-preserving selection. */
    readonly styles: Tables<name, themeName>
  }
}

/**
 * Composes existing native styles in order without flattening or mutating them.
 * A falsy operand returns the other operand unchanged. Two present operands
 * produce an array consumed by the native renderer or flatten.
 */
export function compose<first extends object, second extends object>(
  first: StyleProp<first>,
  second: StyleProp<second>,
): StyleProp<first | second> {
  if (!first) return second
  if (!second) return first
  return [first, second]
}

/** A structured native capability or conversion failure. */
export type Diagnostic = {
  /** Stable category of rejected input. */
  readonly code: 'invalid_options' | 'unsupported_feature' | 'unsupported_value'
  /** Explanation of the supported boundary. */
  readonly message: string
  /** Theme, scheme, style, and property where applicable. */
  readonly path: readonly string[]
}

/**
 * Flattens nested native arrays with shallow, last-declaration-wins precedence.
 * Plain objects retain identity. Falsy values yield undefined outside arrays
 * and are ignored inside them. Structured values remain caller-owned.
 * This is native property merging, not CSS shorthand or cascade resolution.
 */
export function flatten<style extends object>(
  styles: readonly StyleProp<style>[],
): flatten.ReturnType<style>
export function flatten<style extends object>(styles: style): style
export function flatten(styles: Falsy): undefined
export function flatten<style extends object>(
  styles: StyleProp<style>,
): flatten.ReturnType<style> | undefined
export function flatten(styles: unknown): object | undefined {
  if (!styles || typeof styles !== 'object') return undefined
  if (!Array.isArray(styles)) return styles

  const result: Record<string, unknown> = {}
  for (const style of styles) {
    const flattened = flatten(style as StyleProp<Record<string, unknown>>)
    if (!flattened) continue

    // Native flattening includes enumerable inherited declarations.
    for (const key in flattened)
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        value: flattened[key],
        writable: true,
      })
  }
  return result
}

/** Conservative property inference for merged native arrays. */
export declare namespace flatten {
  /** Every property from any input, optional because conditional styles may be absent. */
  type ReturnType<style extends object> = {
    /** Values retain the union of declarations that can supply this property. */
    [key in Keys<style>]?: style extends unknown
      ? key extends keyof style
        ? style[key]
        : never
      : never
  }
}

/** Native scalar style output, with converted logical-unit lengths. */
export type NativeStyle = {
  /** Compiled native property, never a CSS expression or token reference. */
  readonly [property in
    | keyof typeof properties
    | 'rowGap']?: property extends keyof typeof properties
    ? (typeof properties)[property] extends readonly string[]
      ? (typeof properties)[property][number]
      : (typeof properties)[property] extends 'color' | 'font'
        ? string
        : (typeof properties)[property] extends 'size'
          ? number | `${number}%` | 'auto'
          : (typeof properties)[property] extends 'dimension' | 'offset'
            ? number | `${number}%`
            : (typeof properties)[property] extends 'weight'
              ? Weight
              : number
    : number
}

/** Optional native authoring constraint used with satisfies before Style.define. */
export type Properties = {
  /** Portable literals or property-compatible scalar theme references. */
  readonly [property in keyof typeof properties]?:
    | Atom<(typeof properties)[property]>
    | Reference<property>
}

/**
 * Looks up an existing table without allocating or resolving device state.
 * @throws {SelectionError} For unknown own theme labels or color schemes.
 */
export function select<name extends string, themeName extends string>(
  styles: Tables<name, themeName>,
  options: NoInfer<select.Options<themeName>>,
): Readonly<Record<name, NativeStyle>> {
  if (
    !styles ||
    !options ||
    (options.colorScheme !== 'light' && options.colorScheme !== 'dark') ||
    !Object.hasOwn(styles, options.theme)
  )
    throw new SelectionError(
      'Select an existing theme label and light or dark colorScheme.',
    )
  return styles[options.theme][options.colorScheme]
}

/** Native lookup options. */
export declare namespace select {
  /** Both choices are explicit. No environment defaults are consulted. */
  type Options<themeName extends string = string> = {
    /** Precompiled color scheme. */
    readonly colorScheme: ColorScheme
    /** Own label in the compiled tables. */
    readonly theme: themeName
  }
}

/** Rejected lookup of a precompiled native table. */
export class SelectionError extends Error {
  /** Explains the invalid selection without compiling replacement styles. */
  constructor(message: string) {
    super(message)
  }
  /** Stable namespaced error identifier. */
  override name = 'StyleSheet.SelectionError'
}

/** Native styles, nested arrays, and conditional absence for composition. */
export type StyleProp<style extends object = NativeStyle> =
  | Falsy
  | style
  | readonly StyleProp<style>[]

/** Finite style tables indexed by the caller's labels and both schemes. */
export type Tables<
  name extends string = string,
  themeName extends string = string,
> = Readonly<
  Record<
    themeName,
    Readonly<Record<ColorScheme, Readonly<Record<name, NativeStyle>>>>
  >
>

type Falsy = '' | false | null | undefined
type Keys<value> = value extends unknown ? keyof value : never
type Length = 0 | '0' | `${number}px` | `${number}rem`
type Box =
  | Length
  | `${Length} ${Length}`
  | `${Length} ${Length} ${Length}`
  | `${Length} ${Length} ${Length} ${Length}`
type Weight =
  | 'bold'
  | 'normal'
  | 100
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900
type Atom<kind> = kind extends readonly string[]
  ? kind[number]
  : kind extends 'color'
    ? `#${string}` | (typeof colors)[number]
    : kind extends 'font'
      ? string
      : kind extends 'size'
        ? Length | `${number}%` | 'auto'
        : kind extends 'dimension' | 'offset'
          ? Length | `${number}%`
          : kind extends 'integer' | 'number' | 'opacity'
            ? number
            : kind extends 'ratio'
              ? number | `${number}` | `${number} / ${number}`
              : kind extends 'weight'
                ? Weight
                : kind extends 'line'
                  ? Length | number
                  : kind extends 'box' | 'boxSigned'
                    ? Box
                    : Length

type Reference<property extends keyof typeof properties> = {
  [group in Token.Group]: property extends Token.Properties<group>
    ? Token.Reference<group> & { readonly [Token.web]?: never }
    : never
}[Token.Group]

function convert(
  kind: (typeof properties)[keyof typeof properties],
  value: number | string,
  options: compile.Options,
  path: readonly string[],
): number | string {
  if (Array.isArray(kind)) {
    if (typeof value !== 'string' || !kind.includes(value))
      fail('unsupported_value', 'Unsupported native keyword.', path)
    return value
  }
  if (kind === 'ratio') {
    const match =
      typeof value === 'string'
        ? /^\s*(\d+(?:\.\d+)?|\.\d+)(?:\s*\/\s*(\d+(?:\.\d+)?|\.\d+))?\s*$/.exec(
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
    if (
      typeof value !== 'string' ||
      (!/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value) &&
        !(colors as readonly string[]).includes(value))
    )
      fail(
        'unsupported_value',
        'Use a hex color or supported native color keyword.',
        path,
      )
    return value
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

function fail(
  code: Diagnostic['code'],
  message: string,
  path: readonly string[],
): never {
  throw new CompileError([{ code, message, path }])
}

function length(
  value: number | string,
  options: compile.Options,
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

function resolve(
  value: Style.Declaration['value'],
  metadata: Token.Metadata | undefined,
  scheme: ColorScheme,
  path: readonly string[],
): number | string {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (
    !Token.is(value) ||
    Object.getOwnPropertyDescriptor(value, Token.web)?.value
  )
    fail(
      'unsupported_feature',
      'Web variables, expressions, and dynamic bindings are not native scalar tokens.',
      path,
    )
  const shared =
    metadata &&
    (metadata.contract === value.contract ||
      (metadata.contract[Token.identity] !== undefined &&
        metadata.contract[Token.identity] === value.contract[Token.identity]))
  const resolved = shared
    ? Object.hasOwn(metadata.values, value.path)
      ? metadata.values[value.path]
      : undefined
    : value.value
  if (resolved === undefined)
    fail('unsupported_value', 'Theme is missing a live token.', path)
  const scalar = typeof resolved === 'object' ? resolved[scheme] : resolved
  if (typeof scalar !== 'string' && typeof scalar !== 'number')
    fail(
      'unsupported_value',
      'Expected a complete scalar color-scheme pair.',
      path,
    )
  return scalar
}
