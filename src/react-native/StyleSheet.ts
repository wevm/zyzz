/** Compiles portable declarations into immutable native theme tables. @module */
import type * as Style from '../Style.js'
import type * as Theme from '../Theme.js'
import * as Token from '../internal/Token.js'
import type * as Native from '../internal/NativeProperties.js'
import * as Values from './internal/Values.js'
import * as Color from './internal/Color.js'
import * as Scalar from './internal/Scalar.js'

const properties = Scalar.properties

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
  const definition extends Style.Definition<name> = Style.Definition<name>,
  const platform extends 'ios' | 'android' | undefined = undefined,
>(
  options: compile.Options<name, themeName> & {
    styles: definition
    platform?: platform
  },
): compile.ReturnType<name, themeName, definition, platform> {
  for (const key of Object.keys(options))
    if (!['fonts', 'platform', 'styles', 'themes', 'units'].includes(key))
      fail('invalid_options', 'Unknown native compiler option.', [key])

  if (
    options.platform !== undefined &&
    !['android', 'ios'].includes(options.platform)
  )
    fail('invalid_options', 'Expected an explicit ios or android platform.', [
      'platform',
    ])

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
  let scalar = true
  for (const style of options.styles.styles) {
    if (!style.name || names.has(style.name))
      fail('invalid_options', 'Style names must be nonempty and unique.', [
        style.name,
      ])
    names.add(style.name)
    for (const part of sequence(style)) {
      if ((part.targets?.android || part.targets?.ios) && !options.platform)
        fail(
          'invalid_options',
          'Platform branches require an explicit platform.',
          [style.name, 'targets'],
        )

      const declared = new Set<string>()
      for (const declaration of part.declarations) {
        if (
          typeof declaration.value !== 'number' &&
          typeof declaration.value !== 'string'
        )
          scalar = false
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
  let independent: Readonly<Record<string, NativeStyle>> | undefined

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
    const resolution = { schemeIndependent: true }
    for (const scheme of ['light', 'dark'] as const) {
      if (independent) {
        schemes[scheme] = independent
        continue
      }
      if (
        scheme === 'dark' &&
        resolution.schemeIndependent &&
        !diagnostics.length
      ) {
        schemes.dark = schemes.light
        continue
      }
      const compiled: Record<string, NativeStyle> = Object.create(null)
      for (const style of options.styles.styles) {
        const output: Record<string, unknown> = {}
        let lineHeight: number | string | undefined
        for (const part of sequence(style)) {
          for (const declaration of part.declarations) {
            const property = declaration.property as keyof typeof properties
            const path = [label, scheme, style.name, property]
            try {
              const value = resolve(
                declaration.value,
                metadata,
                scheme,
                path,
                resolution,
              )
              if (property === 'lineHeight') {
                lineHeight = value
                continue
              }
              if (property === 'fontVariant') {
                if (typeof value !== 'string')
                  fail(
                    'unsupported_value',
                    'Expected static font variants.',
                    path,
                  )
                try {
                  output.fontVariant = Values.parse({
                    fontVariant:
                      value === 'normal' ? [] : value.trim().split(/\s+/),
                  }).fontVariant
                } catch {
                  fail(
                    'unsupported_value',
                    'Font variant keywords require an explicit native equivalent.',
                    path,
                  )
                }
                continue
              }
              if (property === 'textShadow') {
                const entries = shadows(value, options, path, true)
                if (entries.length > 1)
                  fail(
                    'unsupported_value',
                    'Native text supports one shadow.',
                    path,
                  )
                const shadow = entries[0]
                output.textShadowColor = shadow?.color ?? 'transparent'
                output.textShadowOffset = Object.freeze({
                  width: shadow?.offsetX ?? 0,
                  height: shadow?.offsetY ?? 0,
                })
                output.textShadowRadius = shadow?.blurRadius ?? 0
                continue
              }
              if (property === 'boxShadow') {
                output.boxShadow = shadows(value, options, path)
                continue
              }
              if (property === 'transform') {
                output.transform = transform(value, options, path)
                continue
              }
              if (property === 'transformOrigin') {
                output.transformOrigin = origin(value, options, path)
                continue
              }
              const kind = properties[property]
              const converted = convert(kind, value, options, path)
              if (property === 'padding' || property === 'margin') {
                const values =
                  typeof value === 'string'
                    ? value.trim().split(/\s+/)
                    : [value]
                const [top, right = top, bottom = top, left = right] =
                  values.map((value) =>
                    length(value, options, property === 'margin', path),
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
          for (const branch of ['native', options.platform] as const) {
            if (!branch || !part.targets?.[branch]) continue
            try {
              const native = Values.parse(part.targets[branch])
              Object.assign(output, native)
              if (native.lineHeight !== undefined) lineHeight = undefined
            } catch (error) {
              if (error instanceof CompileError) throw error
              diagnostics.push({
                code: 'unsupported_value',
                message: (error as Error).message,
                path: [label, scheme, style.name, 'targets', branch],
              })
            }
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
      if (scalar && !diagnostics.length) independent = schemes[scheme]
    }
    tables[label] = Object.freeze(schemes)
  }
  if (diagnostics.length) throw new CompileError(diagnostics)
  return Object.freeze({
    styles: Object.freeze(tables) as compile.ReturnType<
      name,
      themeName,
      definition,
      platform
    >['styles'],
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
    /** Explicit destination for platform overrides. Required when platform branches exist. */
    readonly platform?: 'android' | 'ios' | undefined
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
    definition extends Style.Definition<name> = Style.Definition<name>,
    platform = undefined,
  > = {
    /** Precompiled tables, suitable for identity-preserving selection. */
    readonly styles: Readonly<
      Record<
        themeName,
        Readonly<Record<ColorScheme, Compiled<definition, platform, name>>>
      >
    >
  }
}

/**
 * Composes existing native styles in order without flattening or mutating them.
 * A falsy operand returns the other operand unchanged. Two present operands
 * produce an array consumed by the native renderer or flatten.
 */
export function compose<
  const first extends object | Falsy,
  const second extends object | Falsy,
>(first: first, second: second): compose.ReturnType<first, second>
export function compose(
  first: object | Falsy,
  second: object | Falsy,
): object | Falsy {
  if (!first) return second
  if (!second) return first
  return [first, second]
}

/** Identity and mutable pair inference for native composition. */
export declare namespace compose {
  /** Statically absent operands preserve the other operand's exact type. */
  type ReturnType<first, second> = first extends Falsy
    ? second
    : second extends Falsy
      ? first
      : [first, second]
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
export function flatten<const input extends object | Falsy>(
  styles: input,
): flatten.ReturnType<input>
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
  /** Object identity, merged array properties, or absence according to the input. */
  type ReturnType<input> = input extends Falsy
    ? undefined
    : input extends readonly unknown[]
      ? Merged<Leaves<input>>
      : input
}

/** Native style output, with converted logical-unit lengths and ordered transforms. */
export type NativeStyle = Readonly<Native.Output>

type Compiled<definition, platform, name extends string> =
  definition extends Style.Definition<string, infer input>
    ? unknown extends input
      ? Readonly<Record<name, NativeStyle>>
      : Readonly<{
          [key in keyof input as `${Extract<key, number | string>}`]: Omit<
            NativeStyle,
            'overflow'
          > & {
            readonly overflow?: Extract<
              platform extends keyof input[key]
                ? input[key][platform]
                : 'native' extends keyof input[key]
                  ? input[key]['native']
                  : undefined,
              NativeStyle['overflow']
            >
          }
        }>
    : Readonly<Record<name, NativeStyle>>

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
export function select<const tables extends Tables>(
  styles: tables,
  options: NoInfer<select.Options<keyof tables & string>>,
): tables[keyof tables][ColorScheme]
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
  | StyleArray<style>

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
// Bound recursive generic inputs while retaining useful keys at every normal nesting depth.
type Leaves<
  input,
  depth extends readonly unknown[] = [],
> = depth['length'] extends 12
  ? object
  : input extends readonly (infer item)[]
    ? Leaves<item, [...depth, 0]>
    : Exclude<input, Falsy>
type Merged<style> = {
  [key in Keys<style>]?: style extends unknown
    ? key extends keyof style
      ? style[key]
      : never
    : never
}
// Match React Native's mutable outer array and readonly nested-array contract.
type StyleArray<style extends object> = Array<
  style | Falsy | readonly (style | Falsy)[] | StyleArray<style>
>
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
    ? Color.Value
    : kind extends 'shadow' | 'textShadow' | 'fontVariant'
      ? string
      : kind extends 'origin'
        ? Exclude<
            Style.LiteralDeclarations['transformOrigin'],
            readonly unknown[] | undefined
          >
        : kind extends 'transform'
          ? Exclude<
              Style.LiteralDeclarations['transform'],
              readonly unknown[] | undefined
            >
          : kind extends 'font'
            ? string
            : kind extends 'size'
              ? Length | `${number}%` | 'auto'
              : kind extends 'dimension' | 'offset'
                ? Length | `${number}%`
                : kind extends 'integer' | 'number' | 'opacity'
                  ? number
                  : kind extends 'ratio'
                    ? number | `${number} / ${number}`
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
  try {
    return Scalar.convert(kind, value, options, path)
  } catch (error) {
    fail('unsupported_value', (error as Error).message, path)
  }
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
  try {
    return Scalar.length(value, options, signed, path)
  } catch (error) {
    fail('unsupported_value', (error as Error).message, path)
  }
}

type Origin = [number | `${number}%`, number | `${number}%`, number]

function origin(
  value: number | string,
  options: compile.Options,
  path: readonly string[],
): Origin {
  const parts = String(value).trim().toLowerCase().split(/\s+/)
  if (!parts[0] || parts.length > 3)
    fail(
      'unsupported_value',
      'Expected one to three transform-origin values.',
      path,
    )
  let [x, y = 'center', z = '0'] = parts as [string, string?, string?]
  const horizontal = ['left', 'center', 'right']
  const vertical = ['top', 'center', 'bottom']

  if (parts.length === 1 && (x === 'top' || x === 'bottom'))
    [x, y] = ['center', x]
  else if (x === 'top' || x === 'bottom' || y === 'left' || y === 'right') {
    if (!vertical.includes(x) || !horizontal.includes(y))
      fail(
        'unsupported_value',
        'Transform-origin keywords must identify different axes.',
        path,
      )
    ;[x, y] = [y, x]
  }

  const values = [x, y].map((part, index) => {
    const keywords = index === 0 ? horizontal : vertical
    const keyword = keywords.indexOf(part)
    if (keyword !== -1) return `${keyword * 50}%` as `${number}%`
    if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)%$/.test(part)) {
      if (!Number.isFinite(Number(part.slice(0, -1))))
        fail(
          'unsupported_value',
          'Transform-origin percentages must be finite.',
          path,
        )
      return part as `${number}%`
    }
    return length(part, options, true, path)
  })
  // Native declares mutable origin arrays but reads them without mutation. Compiler-owned tuples remain frozen.
  return Object.freeze([
    values[0]!,
    values[1]!,
    length(z, options, true, path),
  ]) as Origin
}

function resolve(
  value: Style.Declaration['value'],
  metadata: Token.Metadata | undefined,
  scheme: ColorScheme,
  path: readonly string[],
  resolution: { schemeIndependent: boolean },
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
  if (typeof resolved === 'object' && resolved.light !== resolved.dark)
    resolution.schemeIndependent = false
  const scalar = typeof resolved === 'object' ? resolved[scheme] : resolved
  if (typeof scalar !== 'string' && typeof scalar !== 'number')
    fail(
      'unsupported_value',
      'Expected a complete scalar color-scheme pair.',
      path,
    )
  return scalar
}

type TransformValues = {
  matrix: number[]
  perspective: number
  rotate: string
  rotateX: string
  rotateY: string
  rotateZ: string
  scale: number
  scaleX: number
  scaleY: number
  skewX: string
  skewY: string
  translateX: number | `${number}%`
  translateY: number | `${number}%`
}
type Transform = {
  [key in keyof TransformValues]: {
    readonly [name in key]: TransformValues[key]
  }
}[keyof TransformValues]

function transform(
  value: number | string,
  options: compile.Options,
  path: readonly string[],
): readonly Transform[] {
  if (typeof value !== 'string' || !value.trim())
    fail('unsupported_value', 'Expected a static transform list.', path)
  let remaining = value.trim()
  const output: Transform[] = []
  if (remaining === 'none') return Object.freeze(output)

  while (remaining) {
    const match = /^([a-z][a-z0-9]*)\(([^()]*)\)/i.exec(remaining)
    if (!match)
      fail('unsupported_value', 'Expected literal transform arguments.', path)
    const name = match[1]!.toLowerCase()
    const args = match[2]!.split(',').map((argument) => argument.trim())
    const limit =
      name === 'matrix'
        ? 6
        : name === 'matrix3d'
          ? 16
          : name === 'translate' || name === 'scale'
            ? 2
            : 1
    if (!args[0] || args.length > limit || args.some((arg) => !arg))
      fail('unsupported_value', 'Invalid transform argument count.', path)
    const argument = args[0]!

    if (name === 'matrix' || name === 'matrix3d') {
      if (
        args.length !== limit ||
        args.some(
          (arg) =>
            !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(arg) ||
            !Number.isFinite(Number(arg)),
        )
      )
        fail(
          'unsupported_value',
          'Matrices require six or sixteen finite numbers.',
          path,
        )
      const values = args.map(Number)
      const matrix =
        name === 'matrix'
          ? [
              values[0]!,
              values[1]!,
              0,
              0,
              values[2]!,
              values[3]!,
              0,
              0,
              0,
              0,
              1,
              0,
              values[4]!,
              values[5]!,
              0,
              1,
            ]
          : values
      const px = options.units?.px ?? 1
      // Conjugate the matrix by the length scale, including projective components.
      for (const index of [12, 13, 14]) matrix[index] = matrix[index]! * px
      for (const index of [3, 7, 11]) matrix[index] = matrix[index]! / px
      if (!matrix.every(Number.isFinite))
        fail(
          'unsupported_value',
          'Converted matrix values must be finite.',
          path,
        )
      Object.freeze(matrix)
      output.push({ matrix })
    } else if (
      name === 'translate' ||
      name === 'translatex' ||
      name === 'translatey'
    ) {
      const values = args.map((arg) => {
        if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)%$/.test(arg)) {
          if (!Number.isFinite(Number(arg.slice(0, -1))))
            fail(
              'unsupported_value',
              'Transform percentages must be finite.',
              path,
            )
          return arg as `${number}%`
        }
        return length(arg, options, true, path)
      })
      if (name === 'translatey') output.push({ translateY: values[0]! })
      else {
        output.push({ translateX: values[0]! })
        if (name === 'translate') output.push({ translateY: values[1] ?? 0 })
      }
    } else if (name === 'scale' || name === 'scalex' || name === 'scaley') {
      const values = args.map((arg) => {
        if (
          !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(arg) ||
          !Number.isFinite(Number(arg))
        )
          fail('unsupported_value', 'Scale requires finite numbers.', path)
        return Number(arg)
      })
      if (name === 'scale' && values.length === 1)
        output.push({ scale: values[0]! })
      else if (name === 'scaley') output.push({ scaleY: values[0]! })
      else {
        output.push({ scaleX: values[0]! })
        if (name === 'scale') output.push({ scaleY: values[1]! })
      }
    } else if (
      ['rotate', 'rotatex', 'rotatey', 'rotatez', 'skewx', 'skewy'].includes(
        name,
      )
    ) {
      const angle =
        /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)$/i.exec(
          argument,
        )
      if (!angle && argument !== '0')
        fail(
          'unsupported_value',
          'Rotation and skew require literal angles.',
          path,
        )
      const unit = angle?.[2]?.toLowerCase() ?? 'deg'
      const number =
        Number(angle?.[1] ?? 0) *
        (unit === 'turn' ? 360 : unit === 'grad' ? 0.9 : 1)
      if (!Number.isFinite(number))
        fail('unsupported_value', 'Transform angles must be finite.', path)
      const converted = `${number}${unit === 'rad' ? 'rad' : 'deg'}`
      const property =
        name === 'rotate'
          ? name
          : `${name.slice(0, -1)}${name.at(-1)!.toUpperCase()}`
      // Native transform entries have one key. Normalize CSS's case-insensitive function names.
      output.push({ [property]: converted } as Transform)
    } else if (name === 'perspective') {
      const distance = length(argument, options, false, path)
      // CSS clamps perspective distances below one CSS pixel before unit conversion.
      output.push({ perspective: Math.max(distance, options.units?.px ?? 1) })
    } else
      fail(
        'unsupported_feature',
        'Transform function is outside the native subset.',
        [...path, match[1]!],
      )

    remaining = remaining.slice(match[0].length).trimStart()
  }
  if (output.length > 1 && output.some((entry) => 'matrix' in entry)) {
    let combined = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    for (const entry of output) {
      const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      const [key, value] = Object.entries(entry)[0]!
      if (key === 'matrix') matrix.splice(0, 16, ...(value as number[]))
      else if (key.startsWith('translate')) {
        if (typeof value !== 'number')
          fail(
            'unsupported_value',
            'Matrix composition requires absolute translations.',
            path,
          )
        matrix[key === 'translateX' ? 12 : 13] = value
      } else if (key === 'perspective') matrix[11] = -1 / (value as number)
      else if (key.startsWith('scale')) {
        if (key !== 'scaleY') matrix[0] = value as number
        if (key !== 'scaleX') matrix[5] = value as number
      } else {
        const angle =
          Number.parseFloat(value as string) *
          ((value as string).endsWith('rad') ? 1 : Math.PI / 180)
        if (key === 'skewX') matrix[4] = Math.tan(angle)
        else if (key === 'skewY') matrix[1] = Math.tan(angle)
        else {
          const [a, b] =
            key === 'rotateX' ? [1, 2] : key === 'rotateY' ? [2, 0] : [0, 1]
          matrix[a! * 4 + a!] = Math.cos(angle)
          matrix[b! * 4 + b!] = Math.cos(angle)
          matrix[a! * 4 + b!] = Math.sin(angle)
          matrix[b! * 4 + a!] = -Math.sin(angle)
        }
      }
      combined = combined.map((_, index) => {
        const row = index % 4
        const column = Math.floor(index / 4)
        return [0, 1, 2, 3].reduce(
          (sum, k) => sum + combined[k * 4 + row]! * matrix[column * 4 + k]!,
          0,
        )
      })
    }
    if (!combined.every(Number.isFinite))
      fail('unsupported_value', 'Converted matrix values must be finite.', path)
    Object.freeze(combined)
    // React Native requires a matrix to be the only transform entry.
    return Object.freeze([Object.freeze({ matrix: combined })])
  }
  return Object.freeze(output.map((entry) => Object.freeze(entry)))
}

function shadows(
  value: number | string,
  options: compile.Options,
  path: readonly string[],
  text = false,
): Extract<NonNullable<Native.Output['boxShadow']>, readonly unknown[]> {
  if (value === 'none') return Object.freeze([])
  if (typeof value !== 'string')
    fail('unsupported_value', 'Expected a static shadow list.', path)
  return Object.freeze(
    value.split(/,(?![^()]*\))/).map((shadow) => {
      const parts = shadow.trim().match(/[a-z]+\([^()]*\)|[^\s]+/gi) ?? []
      const lengths: number[] = []
      let color: string | undefined
      let inset = false
      for (const part of parts) {
        if (part === 'inset' && !inset) {
          inset = true
          continue
        }
        const parsed = Color.parse(part)
        if (parsed !== undefined && color === undefined) {
          color = parsed
          continue
        }
        lengths.push(length(part, options, true, path))
      }
      if (
        lengths.length < 2 ||
        lengths.length > (text ? 3 : 4) ||
        (text && inset) ||
        (lengths[2] ?? 0) < 0 ||
        color === undefined
      )
        fail(
          'unsupported_value',
          'Shadows require two to four lengths, a nonnegative blur, and an explicit absolute color.',
          path,
        )
      return Object.freeze({
        offsetX: lengths[0]!,
        offsetY: lengths[1]!,
        blurRadius: lengths[2] ?? 0,
        spreadDistance: lengths[3] ?? 0,
        color,
        inset,
      })
    }),
  )
}

function sequence(style: Style.NamedStyle): readonly Style.NamedStyle[] {
  const parts = [style]
  for (const rule of style.rules ?? []) {
    if (rule.condition !== undefined)
      fail(
        'unsupported_feature',
        'Selectors, queries, and nested rules are not supported on native.',
        [style.name],
      )
    parts.push(...sequence(rule.style))
  }
  return parts
}
