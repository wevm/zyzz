/**
 * Defines the supported primitive CSS property and value domains.
 * @module
 */
import type * as Compound from './Compound.js'
import type * as Corner from './Corner.js'
import type * as Geometry from './Geometry.js'
import type * as Identifier from './Identifier.js'
import * as Lexical from './Lexical.js'
import type * as Numeric from './Numeric.js'
import type * as Tuple from './Tuple.js'

/** Refines inferred dimension strings where TypeScript's number template is broader than CSS. */
export type Checked<value> = value extends `#${infer hex}`
  ? string extends hex
    ? value
    : Hex<hex> extends true
      ? value
      : never
  : value extends string
    ? BroadDimension<value> extends true
      ? value
      : value extends `${number}${NumericUnit}` | '0'
        ? [Numeric.Parse<value>] extends [never]
          ? never
          : Numeric.Parse<value> extends readonly [infer unit, boolean]
            ? unit extends NumericUnit | ''
              ? value
              : never
            : never
        : value
    : value

// Annotated dimension domains remain usable without pretending their runtime values are known.
type BroadDimension<value extends string> =
  value extends `${number}${infer unit}`
    ? `${number}${unit}` extends value
      ? true
      : false
    : false

type NumericUnit =
  | Unit
  | 'fr'
  | 'ms'
  | 's'
  | 'deg'
  | 'grad'
  | 'rad'
  | 'turn'
  | 'dpi'
  | 'dpcm'
  | 'dppx'
  | 'x'
  | 'hz'
  | 'khz'

type Hex<
  value extends string,
  digits extends readonly unknown[] = [],
> = value extends ''
  ? digits['length'] extends 3 | 4 | 6 | 8
    ? true
    : false
  : digits['length'] extends 8
    ? false
    : value extends `${infer first}${infer rest}`
      ? Lowercase<first> extends
          | '0'
          | '1'
          | '2'
          | '3'
          | '4'
          | '5'
          | '6'
          | '7'
          | '8'
          | '9'
          | 'a'
          | 'b'
          | 'c'
          | 'd'
          | 'e'
          | 'f'
        ? Hex<rest, readonly [...digits, unknown]>
        : false
      : false

/** Math function shapes; dimensional evaluation belongs to the browser. */
export type Calculation =
  `${'abs' | 'acos' | 'asin' | 'atan' | 'atan2' | 'calc' | 'clamp' | 'cos' | 'exp' | 'hypot' | 'log' | 'max' | 'min' | 'mod' | 'pow' | 'rem' | 'round' | 'sign' | 'sin' | 'sqrt' | 'tan'}(${string})`

/** Named, hexadecimal, and absolute functional colors; arguments retain their authored CSS syntax. */
export type Color =
  | (typeof namedColors)[number]
  | (typeof systemColors)[number]
  | 'currentColor'
  | 'currentcolor'
  | 'transparent'
  | `#${string}`
  | `${'color' | 'color-mix' | 'contrast-color' | 'light-dark' | 'hsl' | 'hsla' | 'hwb' | 'lab' | 'lch' | 'oklab' | 'oklch' | 'rgb' | 'rgba'}(${string})`

/** Flexible grid track dimensions. */
export type Fraction = `${number}fr`

/** Structured track values; nested argument semantics belong to the browser. */
export type GridTracks =
  | Calculation
  | Length
  | Fraction
  | 'auto'
  | 'min-content'
  | 'max-content'
  | `${Calculation | Length | Fraction | 'auto' | 'min-content' | 'max-content'} ${string}`
  | `minmax(${string})${string}`
  | `fit-content(${string})${string}`

/** CSS-wide keywords accepted by every supported property. */
export type Global = 'inherit' | 'initial' | 'revert-layer' | 'revert' | 'unset'

/** CSS image functions retain their authored arguments and URL spelling. */
export type Image =
  | Url
  | `${'conic-gradient' | 'cross-fade' | 'element' | 'image' | 'image-set' | 'linear-gradient' | 'paint' | 'radial-gradient' | 'repeating-conic-gradient' | 'repeating-linear-gradient' | 'repeating-radial-gradient'}(${string})`

/** CSS URLs may be quoted or unquoted. */
export type Url = `url(${string})`

/** Finite CSS lengths and percentages; numeric zero needs no unit. */
export type Length = `${number}${(typeof lengthUnits)[number]}` | 0 | '0'

/** Length and percentage units used by scalar type refinements. */
export type Unit = (typeof lengthUnits)[number]

/** Finite property surface with no arbitrary string index signature. */
export type Properties = {
  readonly [key in keyof typeof rules]?: Value<(typeof rules)[key]>
} & { readonly [property: `--${string}`]: number | string }

/** Domain metadata for known properties; custom properties accept scalar values. */
export function rule(property: keyof Properties): Rule | undefined {
  return rules[property as keyof typeof rules]
}

/** Finite seconds and milliseconds; CSS times always require units. */
export type Time = `${number}${'ms' | 's'}`

type Rule = {
  readonly functions?: readonly string[]
  readonly list?: true
  readonly negative?: boolean
} & (
  | { readonly kind: 'compound'; readonly property: keyof Compound.Properties }
  | { readonly kind: 'image' | 'url' }
  | { [kind in Geometry.Kind]: { readonly kind: kind } }[Geometry.Kind]
  | ({ readonly kind: 'identifier' } & Identifier.Options)
  | { readonly kind: 'line'; readonly outline?: true }
  | { readonly kind: 'corner'; readonly items?: 2 | 4 }
  | ({ readonly kind: 'tuple' } & Tuple.Options)
  | {
      readonly auto: boolean
      readonly numeric?: true
      readonly axes?: true
      readonly fraction?: boolean
      readonly items?: 2 | 4
      readonly keywords?: readonly string[]
      readonly kind: 'length'
      readonly negative: boolean
      readonly percentage?: boolean
      readonly standalone?: readonly string[]
    }
  | {
      readonly items?: 2 | 4
      readonly keywords?: readonly string[]
      readonly kind: 'color'
      readonly paint?: true
    }
  | {
      readonly easing?: true
      readonly quoted?: true
      readonly urls?: true
      readonly groups?: readonly (readonly string[])[]
      readonly items?: 2 | 4
      readonly kind: 'enum'
      readonly values: readonly string[]
    }
  | {
      readonly kind: 'percentage'
      readonly keywords?: readonly string[]
      readonly min: number
      readonly max: number
    }
  | { readonly kind: 'grid-line'; readonly items?: 2 | 4 }
  | { readonly kind: 'grid-tracks'; readonly explicit: boolean }
  | {
      readonly integer?: boolean
      readonly length?: true
      readonly keywords?: readonly string[]
      readonly kind: 'number'
      readonly percentage?: true
      readonly max: number
      readonly min: number
    }
  | {
      readonly keywords?: readonly string[]
      readonly kind: 'time'
      readonly negative: boolean
    }
)

type LengthValue<rule extends Rule> =
  | (rule extends { numeric: true } ? number : never)
  | Calculation
  | (rule extends { auto: true } ? 'auto' : never)
  | (rule extends { fraction: true } ? Fraction : never)
  | (rule extends { keywords: readonly (infer keyword)[] } ? keyword : never)
  | (rule extends { percentage: false }
      ? Exclude<Length, `${number}%`>
      : Length)

type LinePart =
  | Color
  | Calculation
  | Exclude<Length, `${number}%`>
  | (typeof border.values)[number]
  | 'medium'
  | 'thick'
  | 'thin'

type Easing =
  | `cubic-bezier(${string})`
  | `steps(${string})`
  | `linear(${string})`

type Keywords<rule> = rule extends {
  keywords: readonly (infer keyword extends string)[]
}
  ? keyword
  : never

type Listed<value extends string | number, rule> =
  | value
  | (rule extends { list: true } ? `${value},${string}` : never)

type TupleAtom<rule extends Rule> = rule extends {
  atoms: readonly (infer atom)[]
}
  ?
      | (Extract<atom, 'number' | 'integer'> extends never
          ? never
          : number | `${number}` | Calculation)
      | ('length' extends atom
          ? Exclude<Length, `${number}%`> | Calculation
          : never)
      | ('percentage' extends atom ? `${number}%` | Calculation : never)
      | ('time' extends atom ? Time | Calculation : never)
      | ('color' extends atom ? Color : never)
      | Keywords<rule>
  : never

type TupleValue<rule extends Rule> =
  | (rule extends { standalone: readonly (infer keyword extends string)[] }
      ? keyword
      : never)
  | (rule extends { min: 1 } ? TupleAtom<rule> : never)
  | `${TupleAtom<rule>} ${string}`
  | (rule extends { prefixes: readonly (infer prefix extends string)[] }
      ? `${prefix} ${string}`
      : never)
  | (rule extends { marker: 'fill'; markerPosition: 'any' }
      ? `fill ${string}`
      : never)

type Value<rule extends Rule> =
  | `${string}var(--${string})${string}`
  | Global
  | (rule extends { functions: readonly (infer name extends string)[] }
      ?
          | `${name}(${string})`
          | (rule extends
              | { items: number }
              | { list: true }
              | { kind: 'compound' }
              ? `${name}(${string})${string}`
              : never)
      : never)
  | (rule extends {
      kind: 'compound'
      property: infer property extends keyof Compound.Properties
    }
      ? Compound.Properties[property]
      : rule extends { kind: 'image' | 'url' }
        ? Listed<
            'none' | Url | (rule extends { kind: 'image' } ? Image : never),
            rule
          >
        : rule extends { kind: 'ratio' }
          ?
              | number
              | Calculation
              | 'auto'
              | `auto ${string}`
              | `${number}${'/' | ' '}${string}`
              | `${Calculation}${'/' | ' '}${string}`
          : rule extends { kind: 'transform' }
            ? 'none' | `${Geometry.FunctionName}(${string})${string}`
            : rule extends { kind: 'rotate' }
              ?
                  | 'none'
                  | 0
                  | Geometry.Angle
                  | Calculation
                  | `${Geometry.Angle | Calculation | number | 'x' | 'y' | 'z'} ${string}`
              : rule extends { kind: 'scale' }
                ?
                    | 'none'
                    | number
                    | `${number}%`
                    | Calculation
                    | `${number | `${number}%` | Calculation} ${string}`
                : rule extends { kind: 'translate' }
                  ?
                      | 'none'
                      | Length
                      | Calculation
                      | `${Length | Calculation} ${string}`
                  : rule extends { kind: 'line' }
                    ?
                        | LinePart
                        | `${LinePart} ${string}`
                        | (rule extends { outline: true }
                            ? 'auto' | `auto ${string}`
                            : never)
                    : rule extends { kind: 'corner' }
                      ?
                          | Corner.Value
                          | (rule extends { items: number }
                              ? `${Corner.Value} ${string}`
                              : never)
                      : rule extends { kind: 'tuple' }
                        ? Listed<TupleValue<rule>, rule>
                        : rule extends { kind: 'identifier' }
                          ? string
                          : rule extends { kind: 'length' }
                            ?
                                | Listed<
                                    Extract<LengthValue<rule>, string | number>,
                                    rule
                                  >
                                | (rule extends { items: number }
                                    ? `${Extract<LengthValue<rule>, string | number>} ${string}`
                                    : never)
                                | (rule extends { axes: true }
                                    ? `${Length | Calculation}/${string}`
                                    : never)
                            : rule extends { kind: 'number' }
                              ? Listed<
                                  | Calculation
                                  | number
                                  | Keywords<rule>
                                  | (rule extends { length: true }
                                      ? Length
                                      : never)
                                  | (rule extends { percentage: true }
                                      ? `${number}%`
                                      : never),
                                  rule
                                >
                              : rule extends { kind: 'percentage' }
                                ? Calculation | `${number}%` | Keywords<rule>
                                : rule extends {
                                      kind: 'enum'
                                      values: readonly (infer keyword extends
                                        string)[]
                                    }
                                  ?
                                      | Listed<
                                          | keyword
                                          | (rule extends { quoted: true }
                                              ? `"${string}"` | `'${string}'`
                                              : never)
                                          | (rule extends { urls: true }
                                              ? `${Url}${string}`
                                              : never)
                                          | (rule extends { easing: true }
                                              ? Easing
                                              : never),
                                          rule
                                        >
                                      | (rule extends { items: number }
                                          ? `${keyword} ${string}`
                                          : never)
                                      | (rule extends {
                                          groups: readonly (readonly (infer component extends
                                            string)[])[]
                                        }
                                          ? `${component} ${string}`
                                          : never)
                                  : rule extends { kind: 'grid-tracks' }
                                    ?
                                        | GridTracks
                                        | (rule extends { explicit: true }
                                            ?
                                                | 'none'
                                                | 'subgrid'
                                                | `repeat(${string})${string}`
                                                | `[${string}`
                                            : never)
                                    : rule extends { kind: 'grid-line' }
                                      ? number | string
                                      : rule extends { kind: 'time' }
                                        ? Listed<
                                            Calculation | Time | Keywords<rule>,
                                            rule
                                          >
                                        :
                                            | Color
                                            | (rule extends { paint: true }
                                                ?
                                                    | Url
                                                    | `${Url}${'' | ' '}${Color | 'none'}`
                                                : never)
                                            | Keywords<rule>
                                            | (rule extends { items: number }
                                                ? `${Color} ${string}`
                                                : never))

const blend = {
  kind: 'enum',
  values: [
    'color',
    'color-burn',
    'color-dodge',
    'darken',
    'difference',
    'exclusion',
    'hard-light',
    'hue',
    'lighten',
    'luminosity',
    'multiply',
    'normal',
    'overlay',
    'saturation',
    'screen',
    'soft-light',
  ],
} as const
const alpha = {
  kind: 'number',
  min: -Infinity,
  max: Infinity,
  percentage: true,
} as const

const fontWidth = {
  kind: 'percentage',
  min: 0,
  max: Infinity,
  keywords: [
    'condensed',
    'expanded',
    'extra-condensed',
    'extra-expanded',
    'normal',
    'semi-condensed',
    'semi-expanded',
    'ultra-condensed',
    'ultra-expanded',
  ],
} as const

const attachmentRange = {
  atoms: ['length', 'percentage'],
  kind: 'tuple',
  list: true,
  max: 1,
  min: 1,
  negative: true,
  prefixes: [
    'cover',
    'contain',
    'entry',
    'exit',
    'entry-crossing',
    'exit-crossing',
  ],
  standalone: [
    'normal',
    'cover',
    'contain',
    'entry',
    'exit',
    'entry-crossing',
    'exit-crossing',
  ],
} as const
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
const fragmentation = {
  kind: 'enum',
  values: [
    'region',
    'avoid-region',
    'auto',
    'avoid',
    'avoid-column',
    'avoid-page',
    'column',
    'left',
    'page',
    'recto',
    'right',
    'verso',
  ],
} as const
const globals = new Set<string>([
  'inherit',
  'initial',
  'revert',
  'revert-layer',
  'unset',
])
const intrinsic = ['fit-content', 'max-content', 'min-content'] as const
const length = { auto: false, kind: 'length', negative: false } as const
/** Shared CSS length unit vocabulary for static domains and query metadata. */
export const lengthUnits = [
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
const margin = { auto: true, kind: 'length', negative: true } as const
const maximum = { ...length, keywords: [...intrinsic, 'none'] } as const
/** Absolute CSS named colors shared with target conversion. */
export const namedColors = [
  'aliceblue',
  'antiquewhite',
  'aqua',
  'aquamarine',
  'azure',
  'beige',
  'bisque',
  'black',
  'blanchedalmond',
  'blue',
  'blueviolet',
  'brown',
  'burlywood',
  'cadetblue',
  'chartreuse',
  'chocolate',
  'coral',
  'cornflowerblue',
  'cornsilk',
  'crimson',
  'cyan',
  'darkblue',
  'darkcyan',
  'darkgoldenrod',
  'darkgray',
  'darkgreen',
  'darkgrey',
  'darkkhaki',
  'darkmagenta',
  'darkolivegreen',
  'darkorange',
  'darkorchid',
  'darkred',
  'darksalmon',
  'darkseagreen',
  'darkslateblue',
  'darkslategray',
  'darkslategrey',
  'darkturquoise',
  'darkviolet',
  'deeppink',
  'deepskyblue',
  'dimgray',
  'dimgrey',
  'dodgerblue',
  'firebrick',
  'floralwhite',
  'forestgreen',
  'fuchsia',
  'gainsboro',
  'ghostwhite',
  'gold',
  'goldenrod',
  'gray',
  'green',
  'greenyellow',
  'grey',
  'honeydew',
  'hotpink',
  'indianred',
  'indigo',
  'ivory',
  'khaki',
  'lavender',
  'lavenderblush',
  'lawngreen',
  'lemonchiffon',
  'lightblue',
  'lightcoral',
  'lightcyan',
  'lightgoldenrodyellow',
  'lightgray',
  'lightgreen',
  'lightgrey',
  'lightpink',
  'lightsalmon',
  'lightseagreen',
  'lightskyblue',
  'lightslategray',
  'lightslategrey',
  'lightsteelblue',
  'lightyellow',
  'lime',
  'limegreen',
  'linen',
  'magenta',
  'maroon',
  'mediumaquamarine',
  'mediumblue',
  'mediumorchid',
  'mediumpurple',
  'mediumseagreen',
  'mediumslateblue',
  'mediumspringgreen',
  'mediumturquoise',
  'mediumvioletred',
  'midnightblue',
  'mintcream',
  'mistyrose',
  'moccasin',
  'navajowhite',
  'navy',
  'oldlace',
  'olive',
  'olivedrab',
  'orange',
  'orangered',
  'orchid',
  'palegoldenrod',
  'palegreen',
  'paleturquoise',
  'palevioletred',
  'papayawhip',
  'peachpuff',
  'peru',
  'pink',
  'plum',
  'powderblue',
  'purple',
  'rebeccapurple',
  'red',
  'rosybrown',
  'royalblue',
  'saddlebrown',
  'salmon',
  'sandybrown',
  'seagreen',
  'seashell',
  'sienna',
  'silver',
  'skyblue',
  'slateblue',
  'slategray',
  'slategrey',
  'snow',
  'springgreen',
  'steelblue',
  'tan',
  'teal',
  'thistle',
  'tomato',
  'turquoise',
  'violet',
  'wheat',
  'white',
  'whitesmoke',
  'yellow',
  'yellowgreen',
] as const
const systemColors = [
  'ActiveBorder',
  'ActiveCaption',
  'AppWorkspace',
  'Background',
  'ButtonHighlight',
  'ButtonShadow',
  'CaptionText',
  'InactiveBorder',
  'InactiveCaption',
  'InactiveCaptionText',
  'InfoBackground',
  'InfoText',
  'Menu',
  'MenuText',
  'Scrollbar',
  'ThreeDDarkShadow',
  'ThreeDFace',
  'ThreeDHighlight',
  'ThreeDLightShadow',
  'ThreeDShadow',
  'Window',
  'WindowFrame',
  'WindowText',

  'AccentColor',
  'AccentColorText',
  'ActiveText',
  'ButtonBorder',
  'ButtonFace',
  'ButtonText',
  'Canvas',
  'CanvasText',
  'Field',
  'FieldText',
  'GrayText',
  'Highlight',
  'HighlightText',
  'LinkText',
  'Mark',
  'MarkText',
  'SelectedItem',
  'SelectedItemText',
  'VisitedText',
] as const
const colorKeywordSet = new Set<string>(
  [...namedColors, ...systemColors].map((value) => value.toLowerCase()),
)

const overflow = {
  kind: 'enum',
  values: ['auto', 'clip', 'hidden', 'scroll', 'visible'],
} as const
const overscroll = {
  kind: 'enum',
  values: ['auto', 'contain', 'none'],
} as const
const positiveInteger = {
  integer: true,
  kind: 'number',
  max: Number.MAX_SAFE_INTEGER,
  min: 1,
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

const track = { explicit: false, kind: 'grid-tracks' } as const

/** Canonical domains shared by legacy aliases and standard declarations. */
const legacyAliases = {
  gridColumnGap: 'columnGap',
  gridGap: 'gap',
  gridRowGap: 'rowGap',
  MozAppearance: 'appearance',
  WebkitAppearance: 'appearance',
  WebkitBorderAfter: 'borderBlockEnd',
  WebkitBorderAfterColor: 'borderBlockEndColor',
  WebkitBorderAfterStyle: 'borderBlockEndStyle',
  WebkitBorderAfterWidth: 'borderBlockEndWidth',
  WebkitBorderBefore: 'borderBlockStart',
  WebkitBorderBeforeColor: 'borderBlockStartColor',
  WebkitBorderBeforeStyle: 'borderBlockStartStyle',
  WebkitBorderBeforeWidth: 'borderBlockStartWidth',
  WebkitBorderEnd: 'borderInlineEnd',
  WebkitBorderEndColor: 'borderInlineEndColor',
  WebkitBorderEndStyle: 'borderInlineEndStyle',
  WebkitBorderEndWidth: 'borderInlineEndWidth',
  WebkitBorderStart: 'borderInlineStart',
  WebkitBorderStartColor: 'borderInlineStartColor',
  WebkitBorderStartStyle: 'borderInlineStartStyle',
  WebkitBorderStartWidth: 'borderInlineStartWidth',
  WebkitUserSelect: 'userSelect',
} as const

const dimension = new RegExp(
  `^[+-]?(?:\\d*\\.\\d+|\\d+)(?:[eE][+-]?\\d+)?(?:${[...lengthUnits, 'deg', 'grad', 'rad', 'turn', 's', 'ms', 'fr', 'dpi', 'dpcm', 'dppx', 'Hz', 'kHz'].join('|')})$`,
  'i',
)

/** Resolves literal/token ambiguity without validating CSS values. */
export function isLiteral(
  property: keyof Properties,
  value: string | number,
): boolean {
  if (value === 0 || globals.has(String(value).toLowerCase())) return true

  const rule: Rule | undefined = rules[property as keyof typeof rules]
  if (!rule) return false

  if (typeof value === 'string') {
    const folded = Lexical.normalize(value)
      .replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '')
      .replace(/[ \t\n\r\f]+/g, ' ')
    if (globals.has(folded)) return true

    if (
      rule.kind === 'color' &&
      (colorKeywordSet.has(folded) ||
        folded === 'transparent' ||
        folded === 'currentcolor')
    )
      return true

    if (
      'keywords' in rule &&
      rule.keywords?.some((keyword) => keyword.toLowerCase() === folded)
    )
      return true

    if (
      rule.kind === 'enum' &&
      rule.values.some((keyword) => keyword.toLowerCase() === folded)
    )
      return true

    if ('auto' in rule && rule.auto && folded === 'auto') return true
    // Dimension and expression spellings always retain literal precedence.
    if (dimension.test(value) || /[#()]/.test(value)) return true
  }

  return rule.kind === 'number' && typeof value === 'number'
}

/** Serializes public camel-case property names, including numeric legacy spellings. */
export function name(property: string): string {
  if (property.startsWith('--')) return property

  if (property === 'MsScrollbar3dlightColor')
    return '-ms-scrollbar-3dlight-color'

  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

const properties = {
  accentColor: { ...color, keywords: ['auto'] },
  alignContent: {
    kind: 'enum',
    values: [
      'baseline',
      'center',
      'end',
      'first baseline',
      'flex-end',
      'flex-start',
      'last baseline',
      'normal',
      'safe center',
      'safe end',
      'safe flex-end',
      'safe flex-start',
      'safe start',
      'space-around',
      'space-between',
      'space-evenly',
      'start',
      'stretch',
      'unsafe center',
      'unsafe end',
      'unsafe flex-end',
      'unsafe flex-start',
      'unsafe start',
    ],
  },
  alignItems: {
    kind: 'enum',
    values: [
      'anchor-center',
      'baseline',
      'center',
      'end',
      'first baseline',
      'flex-end',
      'flex-start',
      'last baseline',
      'normal',
      'safe center',
      'safe end',
      'safe flex-end',
      'safe flex-start',
      'safe self-end',
      'safe self-start',
      'safe start',
      'self-end',
      'self-start',
      'start',
      'stretch',
      'unsafe center',
      'unsafe end',
      'unsafe flex-end',
      'unsafe flex-start',
      'unsafe self-end',
      'unsafe self-start',
      'unsafe start',
    ],
  },
  alignmentBaseline: {
    kind: 'enum',
    values: [
      'alphabetic',
      'baseline',
      'central',
      'ideographic',
      'mathematical',
      'middle',
      'text-after-edge',
      'text-before-edge',
    ],
  },
  alignSelf: {
    kind: 'enum',
    values: [
      'anchor-center',
      'auto',
      'baseline',
      'center',
      'end',
      'first baseline',
      'flex-end',
      'flex-start',
      'last baseline',
      'normal',
      'safe center',
      'safe end',
      'safe flex-end',
      'safe flex-start',
      'safe self-end',
      'safe self-start',
      'safe start',
      'self-end',
      'self-start',
      'start',
      'stretch',
      'unsafe center',
      'unsafe end',
      'unsafe flex-end',
      'unsafe flex-start',
      'unsafe self-end',
      'unsafe self-start',
      'unsafe start',
    ],
  },
  alignTracks: { kind: 'compound', property: 'alignTracks' },
  all: {
    kind: 'enum',
    values: ['inherit', 'initial', 'revert', 'revert-layer', 'unset'],
  },
  alt: { kind: 'enum', values: [], quoted: true, functions: ['attr'] },
  anchorName: {
    dashed: true,
    keywords: ['none'],
    kind: 'identifier',
    separator: 'comma',
    standalone: ['none'],
  },
  anchorScope: {
    dashed: true,
    keywords: ['all', 'none'],
    kind: 'identifier',
    separator: 'comma',
    standalone: ['all', 'none'],
  },
  animation: { kind: 'compound', property: 'animation' },
  animationComposition: {
    kind: 'enum',
    list: true,
    values: ['accumulate', 'add', 'replace'],
  },
  animationDelay: { kind: 'time', list: true, negative: true },
  animationDirection: {
    kind: 'enum',
    list: true,
    values: ['alternate', 'alternate-reverse', 'normal', 'reverse'],
  },
  animationDuration: {
    keywords: ['auto'],
    kind: 'time',
    list: true,
    negative: false,
  },
  animationFillMode: {
    kind: 'enum',
    list: true,
    values: ['backwards', 'both', 'forwards', 'none'],
  },
  animationIterationCount: {
    keywords: ['infinite'],
    kind: 'number',
    list: true,
    max: Infinity,
    min: 0,
  },
  animationName: { keywords: ['none'], kind: 'identifier', separator: 'comma' },
  animationPlayState: {
    kind: 'enum',
    list: true,
    values: ['paused', 'running'],
  },
  animationRange: { kind: 'compound', property: 'animationRange' },
  animationTimeline: {
    dashed: true,
    keywords: ['auto', 'none'],
    kind: 'identifier',
    separator: 'comma',
  },
  animationRangeEnd: attachmentRange,
  animationRangeStart: attachmentRange,
  animationTimingFunction: {
    easing: true,
    kind: 'enum',
    list: true,
    values: [
      'ease',
      'ease-in',
      'ease-in-out',
      'ease-out',
      'linear',
      'step-end',
      'step-start',
    ],
  },
  animationTrigger: { kind: 'compound', property: 'animationTrigger' },
  appearance: {
    kind: 'enum',
    values: [
      'auto',
      'button',
      'checkbox',
      'listbox',
      'menulist',
      'menulist-button',
      'meter',
      'none',
      'progress-bar',
      'radio',
      'searchfield',
      'textarea',
      'textfield',
    ],
  },
  aspectRatio: { kind: 'ratio' },
  backdropFilter: { kind: 'compound', property: 'backdropFilter' },
  backfaceVisibility: { kind: 'enum', values: ['hidden', 'visible'] },
  background: { kind: 'compound', property: 'background' },
  backgroundAttachment: {
    kind: 'enum',
    list: true,
    values: ['fixed', 'local', 'scroll'],
  },
  backgroundBlendMode: { ...blend, list: true },
  backgroundClip: {
    kind: 'enum',
    list: true,
    values: ['border-area', 'border-box', 'content-box', 'padding-box', 'text'],
  },
  backgroundColor: color,
  backgroundImage: { kind: 'image', list: true },
  backgroundOrigin: {
    kind: 'enum',
    list: true,
    values: ['border-box', 'content-box', 'padding-box'],
  },
  backgroundPosition: { kind: 'compound', property: 'backgroundPosition' },
  backgroundPositionX: { kind: 'compound', property: 'backgroundPositionX' },
  backgroundPositionY: { kind: 'compound', property: 'backgroundPositionY' },
  backgroundRepeat: {
    kind: 'enum',
    items: 2,
    list: true,
    values: ['no-repeat', 'repeat', 'repeat-x', 'repeat-y', 'round', 'space'],
  },
  backgroundRepeatX: {
    kind: 'enum',
    values: ['repeat', 'space', 'round', 'no-repeat'],
    list: true,
  },
  backgroundRepeatY: {
    kind: 'enum',
    values: ['repeat', 'space', 'round', 'no-repeat'],
    list: true,
  },
  backgroundSize: {
    ...length,
    auto: true,
    items: 2,
    list: true,
    keywords: ['contain', 'cover'],
  },
  baselineShift: {
    ...length,
    keywords: ['baseline', 'sub', 'super'],
    negative: true,
  },
  baselineSource: { kind: 'enum', values: ['auto', 'first', 'last'] },
  blockEllipsis: {
    kind: 'enum',
    values: ['no-ellipsis', 'auto'],
    quoted: true,
  },
  blockSize: {
    ...size,
    functions: ['anchor-size', 'calc-size', 'fit-content'],
  },
  border: { kind: 'line' },
  borderBlock: { kind: 'line' },
  borderBlockColor: { ...color, items: 2 },
  borderBlockEnd: { kind: 'line' },
  borderBlockEndColor: color,
  borderBlockEndStyle: border,
  borderBlockEndWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
  borderBlockStart: { kind: 'line' },
  borderBlockStartColor: color,
  borderBlockStartStyle: border,
  borderBlockStartWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
  borderBlockStyle: { ...border, items: 2 },
  borderBlockWidth: {
    ...stroke,
    items: 2,
    keywords: ['medium', 'thick', 'thin'],
  },
  borderBottom: { kind: 'line' },
  borderBottomColor: color,
  borderBottomLeftRadius: { ...length, items: 2 },
  borderBottomRightRadius: { ...length, items: 2 },
  borderBottomStyle: border,
  borderBottomWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
  borderCollapse: { kind: 'enum', values: ['collapse', 'separate'] },
  borderColor: { ...color, items: 4 },
  borderEndEndRadius: { ...length, items: 2 },
  borderEndStartRadius: { ...length, items: 2 },
  borderImage: { kind: 'compound', property: 'borderImage' },
  borderImageOutset: {
    kind: 'tuple',
    atoms: ['length', 'number'],
    min: 1,
    max: 4,
    negative: false,
  },
  borderImageRepeat: {
    items: 2,
    kind: 'enum',
    values: ['repeat', 'round', 'space', 'stretch'],
  },
  borderImageSlice: {
    kind: 'tuple',
    atoms: ['number', 'percentage'],
    marker: 'fill',
    markerPosition: 'any',
    min: 1,
    max: 4,
    negative: false,
  },
  borderImageSource: { kind: 'image' },
  borderImageWidth: {
    kind: 'tuple',
    atoms: ['length', 'number', 'percentage'],
    keywords: ['auto'],
    min: 1,
    max: 4,
    negative: false,
  },
  borderInline: { kind: 'line' },
  borderInlineColor: { ...color, items: 2 },
  borderInlineEnd: { kind: 'line' },
  borderInlineEndColor: color,
  borderInlineEndStyle: border,
  borderInlineEndWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
  borderInlineStart: { kind: 'line' },
  borderInlineStartColor: color,
  borderInlineStartStyle: border,
  borderInlineStartWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
  borderInlineStyle: { ...border, items: 2 },
  borderInlineWidth: {
    ...stroke,
    items: 2,
    keywords: ['medium', 'thick', 'thin'],
  },
  borderLeft: { kind: 'line' },
  borderLeftColor: color,
  borderLeftStyle: border,
  borderLeftWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
  borderRadius: { ...length, axes: true, items: 4 },
  borderRight: { kind: 'line' },
  borderRightColor: color,
  borderRightStyle: border,
  borderRightWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
  borderShape: { kind: 'compound', property: 'borderShape' },
  borderSpacing: { ...stroke, items: 2 },
  borderStartEndRadius: { ...length, items: 2 },
  borderStartStartRadius: { ...length, items: 2 },
  borderStyle: { ...border, items: 4 },
  borderTop: { kind: 'line' },
  borderTopColor: color,
  borderTopLeftRadius: { ...length, items: 2 },
  borderTopRightRadius: { ...length, items: 2 },
  borderTopStyle: border,
  borderTopWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
  borderWidth: { ...stroke, items: 4, keywords: ['medium', 'thick', 'thin'] },
  bottom: { ...margin, functions: ['anchor', 'anchor-size'] },
  boxAlign: {
    kind: 'enum',
    values: ['baseline', 'center', 'end', 'start', 'stretch'],
  },
  boxDecorationBreak: { kind: 'enum', values: ['clone', 'slice'] },
  boxDirection: { kind: 'enum', values: ['normal', 'reverse'] },
  boxFlex: { kind: 'number', max: Number.MAX_SAFE_INTEGER, min: 0 },
  boxFlexGroup: {
    integer: true,
    kind: 'number',
    max: Number.MAX_SAFE_INTEGER,
    min: 1,
  },
  boxLines: { kind: 'enum', values: ['multiple', 'single'] },
  boxOrdinalGroup: {
    integer: true,
    kind: 'number',
    max: Number.MAX_SAFE_INTEGER,
    min: 1,
  },
  boxOrient: {
    kind: 'enum',
    values: ['block-axis', 'horizontal', 'inline-axis', 'vertical'],
  },
  boxPack: { kind: 'enum', values: ['center', 'end', 'justify', 'start'] },
  boxShadow: { kind: 'compound', property: 'boxShadow' },
  boxSizing: { kind: 'enum', values: ['border-box', 'content-box'] },
  breakAfter: {
    ...fragmentation,
    values: [
      'all',
      'always',
      'auto',
      'avoid',
      'avoid-column',
      'avoid-page',
      'avoid-region',
      'column',
      'left',
      'page',
      'recto',
      'region',
      'right',
      'verso',
    ],
  },
  breakBefore: {
    ...fragmentation,
    values: [
      'all',
      'always',
      'auto',
      'avoid',
      'avoid-column',
      'avoid-page',
      'avoid-region',
      'column',
      'left',
      'page',
      'recto',
      'region',
      'right',
      'verso',
    ],
  },
  breakInside: {
    kind: 'enum',
    values: ['avoid-region', 'auto', 'avoid', 'avoid-column', 'avoid-page'],
  },
  bufferedRendering: { kind: 'enum', values: ['auto', 'dynamic', 'static'] },
  captionSide: { kind: 'enum', values: ['bottom', 'top'] },
  caret: { kind: 'compound', property: 'caret' },
  caretAnimation: { kind: 'enum', values: ['auto', 'manual'] },
  caretColor: { ...color, keywords: ['auto'] },
  caretShape: { kind: 'enum', values: ['auto', 'bar', 'block', 'underscore'] },
  clear: {
    kind: 'enum',
    values: ['both', 'inline-end', 'inline-start', 'left', 'none', 'right'],
  },
  clip: { kind: 'compound', property: 'clip' },
  clipPath: { kind: 'compound', property: 'clipPath' },
  clipRule: { kind: 'enum', values: ['evenodd', 'nonzero'] },
  color,
  colorInterpolation: { kind: 'enum', values: ['auto', 'sRGB', 'linearRGB'] },
  colorInterpolationFilters: {
    kind: 'enum',
    values: ['auto', 'linearRGB', 'sRGB'],
  },
  colorRendering: {
    kind: 'enum',
    values: ['auto', 'optimizeSpeed', 'optimizeQuality'],
  },
  colorScheme: {
    kind: 'identifier',
    keywords: [
      'dark',
      'dark light',
      'light',
      'light dark',
      'normal',
      'only dark',
      'only light',
    ],
  },
  columnCount: { ...positiveInteger, keywords: ['auto'] },
  columnFill: { kind: 'enum', values: ['auto', 'balance'] },
  columnGap: { ...length, keywords: ['normal'] },
  columnHeight: { ...length, auto: true, percentage: false },
  columnRule: { kind: 'line' },
  columnRuleBreak: { kind: 'enum', values: ['none', 'normal', 'intersection'] },
  columnRuleColor: color,
  columnRuleInset: { kind: 'compound', property: 'ruleInset' },
  columnRuleInsetCap: {
    ...length,
    negative: true,
    items: 2,
    keywords: ['overlap-join'],
  },
  columnRuleInsetCapEnd: {
    ...length,
    negative: true,
    keywords: ['overlap-join'],
  },
  columnRuleInsetCapStart: {
    ...length,
    negative: true,
    keywords: ['overlap-join'],
  },
  columnRuleInsetEnd: { ...length, negative: true, keywords: ['overlap-join'] },
  columnRuleInsetJunction: {
    ...length,
    negative: true,
    items: 2,
    keywords: ['overlap-join'],
  },
  columnRuleInsetJunctionEnd: {
    ...length,
    negative: true,
    keywords: ['overlap-join'],
  },
  columnRuleInsetJunctionStart: {
    ...length,
    negative: true,
    keywords: ['overlap-join'],
  },
  columnRuleInsetStart: {
    ...length,
    negative: true,
    keywords: ['overlap-join'],
  },
  columnRuleStyle: border,
  columnRuleVisibilityItems: {
    kind: 'enum',
    values: ['all', 'around', 'between', 'normal'],
  },
  columnRuleWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
  columns: { kind: 'compound', property: 'columns' },
  columnSpan: { kind: 'enum', values: ['all', 'none'] },
  columnWidth: { ...stroke, auto: true },
  columnWrap: { kind: 'enum', values: ['auto', 'nowrap', 'wrap'] },
  contain: {
    groups: [['size', 'inline-size'], ['layout'], ['style'], ['paint']],
    kind: 'enum',
    values: [
      'content',
      'inline-size',
      'layout',
      'none',
      'paint',
      'size',
      'strict',
      'style',
    ],
  },
  container: { kind: 'compound', property: 'container' },
  containIntrinsicBlockSize: {
    atoms: ['length'],
    keywords: ['none'],
    kind: 'tuple',
    max: 1,
    min: 1,
    negative: false,
    prefixes: ['auto'],
  },
  containIntrinsicHeight: {
    atoms: ['length'],
    keywords: ['none'],
    kind: 'tuple',
    max: 1,
    min: 1,
    negative: false,
    prefixes: ['auto'],
  },
  containIntrinsicInlineSize: {
    atoms: ['length'],
    keywords: ['none'],
    kind: 'tuple',
    max: 1,
    min: 1,
    negative: false,
    prefixes: ['auto'],
  },
  containIntrinsicSize: {
    atoms: ['length'],
    keywords: ['none'],
    kind: 'tuple',
    max: 2,
    min: 1,
    negative: false,
    prefixes: ['auto'],
  },
  containIntrinsicWidth: {
    atoms: ['length'],
    keywords: ['none'],
    kind: 'tuple',
    max: 1,
    min: 1,
    negative: false,
    prefixes: ['auto'],
  },
  containerName: {
    keywords: ['none'],
    kind: 'identifier',
    separator: 'space',
    standalone: ['none'],
    excluded: ['and', 'not', 'or'],
  },
  containerType: {
    kind: 'enum',
    values: [
      'inline-size',
      'inline-size scroll-state',
      'normal',
      'scroll-state',
      'scroll-state inline-size',
      'scroll-state size',
      'size',
      'size scroll-state',
    ],
  },
  content: { kind: 'compound', property: 'content' },
  contentVisibility: { kind: 'enum', values: ['auto', 'hidden', 'visible'] },
  continue: {
    kind: 'enum',
    values: ['auto', 'discard', 'collapse', '-webkit-legacy'],
  },
  cornerBlockEndShape: { kind: 'corner', items: 2 },
  cornerBlockStartShape: { kind: 'corner', items: 2 },
  cornerBottomLeftShape: { kind: 'corner' },
  cornerBottomRightShape: { kind: 'corner' },
  cornerBottomShape: { kind: 'corner', items: 2 },
  cornerEndEndShape: { kind: 'corner' },
  cornerEndStartShape: { kind: 'corner' },
  cornerInlineEndShape: { kind: 'corner', items: 2 },
  cornerInlineStartShape: { kind: 'corner', items: 2 },
  cornerLeftShape: { kind: 'corner', items: 2 },
  cornerRightShape: { kind: 'corner', items: 2 },
  cornerShape: { kind: 'corner', items: 4 },
  cornerStartEndShape: { kind: 'corner' },
  cornerStartStartShape: { kind: 'corner' },
  cornerTopLeftShape: { kind: 'corner' },
  cornerTopRightShape: { kind: 'corner' },
  cornerTopShape: { kind: 'corner', items: 2 },
  counterIncrement: { kind: 'compound', property: 'counterIncrement' },
  counterReset: { kind: 'compound', property: 'counterReset' },
  counterSet: { kind: 'compound', property: 'counterSet' },
  cursor: {
    kind: 'enum',
    urls: true,
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
  cx: { ...length, negative: true },
  cy: { ...length, negative: true },
  d: { kind: 'compound', property: 'd' },
  direction: { kind: 'enum', values: ['ltr', 'rtl'] },
  display: {
    kind: 'enum',
    values: [
      'block',
      'block flex',
      'block flow',
      'block flow list-item',
      'block flow-root',
      'block flow-root list-item',
      'block grid',
      'block list-item',
      'block list-item flow',
      'block list-item flow-root',
      'block ruby',
      'block table',
      'contents',
      'flex',
      'flex block',
      'flex inline',
      'flex run-in',
      'flow',
      'flow block',
      'flow block list-item',
      'flow inline',
      'flow inline list-item',
      'flow list-item',
      'flow list-item block',
      'flow list-item inline',
      'flow list-item run-in',
      'flow run-in',
      'flow run-in list-item',
      'flow-root',
      'flow-root block',
      'flow-root block list-item',
      'flow-root inline',
      'flow-root inline list-item',
      'flow-root list-item',
      'flow-root list-item block',
      'flow-root list-item inline',
      'flow-root list-item run-in',
      'flow-root run-in',
      'flow-root run-in list-item',
      'grid',
      'grid block',
      'grid inline',
      'grid run-in',
      'inline',
      'inline flex',
      'inline flow',
      'inline flow list-item',
      'inline flow-root',
      'inline flow-root list-item',
      'inline grid',
      'inline list-item',
      'inline list-item flow',
      'inline list-item flow-root',
      'inline ruby',
      'inline table',
      'inline-block',
      'inline-flex',
      'inline-grid',
      'inline-list-item',
      'inline-table',
      'list-item',
      'list-item block',
      'list-item block flow',
      'list-item block flow-root',
      'list-item flow',
      'list-item flow block',
      'list-item flow inline',
      'list-item flow run-in',
      'list-item flow-root',
      'list-item flow-root block',
      'list-item flow-root inline',
      'list-item flow-root run-in',
      'list-item inline',
      'list-item inline flow',
      'list-item inline flow-root',
      'list-item run-in',
      'list-item run-in flow',
      'list-item run-in flow-root',
      'none',
      'ruby',
      'ruby block',
      'ruby inline',
      'ruby run-in',
      'ruby-base',
      'ruby-base-container',
      'ruby-text',
      'ruby-text-container',
      'run-in',
      'run-in flex',
      'run-in flow',
      'run-in flow list-item',
      'run-in flow-root',
      'run-in flow-root list-item',
      'run-in grid',
      'run-in list-item',
      'run-in list-item flow',
      'run-in list-item flow-root',
      'run-in ruby',
      'run-in table',
      'table',
      'table block',
      'table inline',
      'table run-in',
      'table-caption',
      'table-cell',
      'table-column',
      'table-column-group',
      'table-footer-group',
      'table-header-group',
      'table-row',
      'table-row-group',
    ],
  },
  dominantBaseline: {
    kind: 'enum',
    values: [
      'alphabetic',
      'auto',
      'central',
      'hanging',
      'ideographic',
      'mathematical',
      'middle',
      'text-bottom',
      'text-top',
    ],
  },
  dynamicRangeLimit: {
    kind: 'enum',
    values: ['constrained', 'no-limit', 'standard'],
    functions: ['dynamic-range-limit-mix'],
  },
  emptyCells: { kind: 'enum', values: ['hide', 'show'] },
  fieldSizing: { kind: 'enum', values: ['content', 'fixed'] },
  fill: {
    ...color,
    keywords: ['context-fill', 'context-stroke', 'none'],
    paint: true,
  },
  fillOpacity: alpha,
  fillRule: { kind: 'enum', values: ['evenodd', 'nonzero'] },
  filter: { kind: 'compound', property: 'filter' },
  flex: {
    kind: 'compound',
    property: 'flex',
    functions: ['anchor-size', 'calc-size'],
  },
  flexBasis: {
    ...size,
    keywords: ['content', ...intrinsic],
    functions: ['anchor-size', 'calc-size', 'fit-content'],
  },
  flexDirection: {
    kind: 'enum',
    values: ['column', 'column-reverse', 'row', 'row-reverse'],
  },
  flexFlow: {
    kind: 'enum',
    values: [
      'balance',
      'balance column',
      'balance column-reverse',
      'balance row',
      'balance row-reverse',
      'balance wrap',
      'balance wrap column',
      'balance wrap column-reverse',
      'balance wrap row',
      'balance wrap row-reverse',
      'balance wrap-reverse',
      'balance wrap-reverse column',
      'balance wrap-reverse column-reverse',
      'balance wrap-reverse row',
      'balance wrap-reverse row-reverse',
      'column',
      'column balance',
      'column balance wrap',
      'column balance wrap-reverse',
      'column nowrap',
      'column wrap',
      'column wrap balance',
      'column wrap-reverse',
      'column wrap-reverse balance',
      'column-reverse',
      'column-reverse balance',
      'column-reverse balance wrap',
      'column-reverse balance wrap-reverse',
      'column-reverse nowrap',
      'column-reverse wrap',
      'column-reverse wrap balance',
      'column-reverse wrap-reverse',
      'column-reverse wrap-reverse balance',
      'nowrap',
      'nowrap column',
      'nowrap column-reverse',
      'nowrap row',
      'nowrap row-reverse',
      'row',
      'row balance',
      'row balance wrap',
      'row balance wrap-reverse',
      'row nowrap',
      'row wrap',
      'row wrap balance',
      'row wrap-reverse',
      'row wrap-reverse balance',
      'row-reverse',
      'row-reverse balance',
      'row-reverse balance wrap',
      'row-reverse balance wrap-reverse',
      'row-reverse nowrap',
      'row-reverse wrap',
      'row-reverse wrap balance',
      'row-reverse wrap-reverse',
      'row-reverse wrap-reverse balance',
      'wrap',
      'wrap balance',
      'wrap balance column',
      'wrap balance column-reverse',
      'wrap balance row',
      'wrap balance row-reverse',
      'wrap column',
      'wrap column-reverse',
      'wrap row',
      'wrap row-reverse',
      'wrap-reverse',
      'wrap-reverse balance',
      'wrap-reverse balance column',
      'wrap-reverse balance column-reverse',
      'wrap-reverse balance row',
      'wrap-reverse balance row-reverse',
      'wrap-reverse column',
      'wrap-reverse column-reverse',
      'wrap-reverse row',
      'wrap-reverse row-reverse',
    ],
  },
  flexGrow: { kind: 'number', max: Infinity, min: 0 },
  flexLineCount: {
    integer: true,
    kind: 'number',
    max: Number.MAX_SAFE_INTEGER,
    min: 1,
  },
  flexShrink: { kind: 'number', max: Infinity, min: 0 },
  flexWrap: {
    kind: 'enum',
    values: [
      'balance',
      'balance wrap',
      'balance wrap-reverse',
      'nowrap',
      'wrap',
      'wrap balance',
      'wrap-reverse',
      'wrap-reverse balance',
    ],
  },
  float: {
    kind: 'enum',
    values: ['inline-end', 'inline-start', 'left', 'none', 'right'],
  },
  floodColor: color,
  floodOpacity: alpha,
  flowTolerance: { ...length, keywords: ['normal', 'infinite'] },
  font: { kind: 'compound', property: 'font' },
  fontFamily: { kind: 'compound', property: 'fontFamily' },
  fontFeatureSettings: { kind: 'compound', property: 'fontFeatureSettings' },
  fontKerning: { kind: 'enum', values: ['auto', 'none', 'normal'] },
  fontLanguageOverride: { kind: 'compound', property: 'fontLanguageOverride' },
  fontOpticalSizing: { kind: 'enum', values: ['auto', 'none'] },
  fontPalette: {
    dashed: true,
    keywords: ['dark', 'light', 'normal'],
    kind: 'identifier',
  },
  fontSize: {
    ...length,
    keywords: [
      'large',
      'larger',
      'math',
      'medium',
      'small',
      'smaller',
      'x-large',
      'x-small',
      'xx-large',
      'xx-small',
      'xxx-large',
    ],
  },
  fontSizeAdjust: {
    atoms: ['number'],
    keywords: ['from-font'],
    kind: 'tuple',
    max: 1,
    min: 1,
    negative: false,
    prefixes: ['ex-height', 'cap-height', 'ch-width', 'ic-width', 'ic-height'],
    standalone: ['none'],
  },
  fontSmooth: {
    ...stroke,
    keywords: [
      'always',
      'auto',
      'large',
      'medium',
      'never',
      'small',
      'x-large',
      'x-small',
      'xx-large',
      'xx-small',
      'xxx-large',
    ],
  },
  fontStretch: fontWidth,
  fontStyle: { kind: 'compound', property: 'fontStyle' },
  fontSynthesis: {
    groups: [['position'], ['small-caps'], ['style'], ['weight']],
    kind: 'enum',
    values: ['none', 'position', 'small-caps', 'style', 'weight'],
  },
  fontSynthesisPosition: { kind: 'enum', values: ['auto', 'none'] },
  fontSynthesisSmallCaps: { kind: 'enum', values: ['auto', 'none'] },
  fontSynthesisStyle: { kind: 'enum', values: ['auto', 'none'] },
  fontSynthesisWeight: { kind: 'enum', values: ['auto', 'none'] },
  fontVariant: { kind: 'compound', property: 'fontVariant' },
  fontVariantAlternates: {
    kind: 'compound',
    property: 'fontVariantAlternates',
  },
  fontVariantCaps: {
    kind: 'enum',
    values: [
      'all-petite-caps',
      'all-small-caps',
      'normal',
      'petite-caps',
      'small-caps',
      'titling-caps',
      'unicase',
    ],
  },
  fontVariantEastAsian: {
    groups: [
      ['jis04', 'jis78', 'jis83', 'jis90', 'simplified', 'traditional'],
      ['full-width', 'proportional-width'],
      ['ruby'],
    ],
    kind: 'enum',
    values: [
      'full-width',
      'jis04',
      'jis78',
      'jis83',
      'jis90',
      'normal',
      'proportional-width',
      'ruby',
      'simplified',
      'traditional',
    ],
  },
  fontVariantEmoji: {
    kind: 'enum',
    values: ['emoji', 'normal', 'text', 'unicode'],
  },
  fontVariantLigatures: {
    groups: [
      ['common-ligatures', 'no-common-ligatures'],
      ['contextual', 'no-contextual'],
      ['discretionary-ligatures', 'no-discretionary-ligatures'],
      ['historical-ligatures', 'no-historical-ligatures'],
    ],
    kind: 'enum',
    values: [
      'common-ligatures',
      'contextual',
      'discretionary-ligatures',
      'historical-ligatures',
      'no-common-ligatures',
      'no-contextual',
      'no-discretionary-ligatures',
      'no-historical-ligatures',
      'none',
      'normal',
    ],
  },
  fontVariantNumeric: {
    groups: [
      ['diagonal-fractions', 'stacked-fractions'],
      ['lining-nums', 'oldstyle-nums'],
      ['ordinal'],
      ['proportional-nums', 'tabular-nums'],
      ['slashed-zero'],
    ],
    kind: 'enum',
    values: [
      'diagonal-fractions',
      'lining-nums',
      'normal',
      'oldstyle-nums',
      'ordinal',
      'proportional-nums',
      'slashed-zero',
      'stacked-fractions',
      'tabular-nums',
    ],
  },
  fontVariantPosition: { kind: 'enum', values: ['normal', 'sub', 'super'] },
  fontVariationSettings: {
    kind: 'compound',
    property: 'fontVariationSettings',
  },
  fontWeight: {
    kind: 'number',
    max: 1000,
    min: 1,
    keywords: ['bold', 'bolder', 'lighter', 'normal'],
  },
  fontWidth,
  forcedColorAdjust: {
    kind: 'enum',
    values: ['auto', 'none', 'preserve-parent-color'],
  },
  frameSizing: {
    kind: 'enum',
    values: [
      'auto',
      'content-block-size',
      'content-height',
      'content-inline-size',
      'content-width',
    ],
  },
  gap: { ...length, items: 2, keywords: ['normal'] },
  glyphOrientationVertical: {
    kind: 'compound',
    property: 'glyphOrientationVertical',
  },
  grid: { kind: 'compound', property: 'grid' },
  gridArea: { kind: 'grid-line', items: 4 },
  gridAutoColumns: track,
  gridAutoFlow: {
    kind: 'enum',
    values: [
      'column',
      'column dense',
      'dense',
      'dense column',
      'dense row',
      'row',
      'row dense',
    ],
  },
  gridAutoRows: track,
  gridColumn: { kind: 'grid-line', items: 2 },
  gridColumnEnd: { kind: 'grid-line' },
  gridColumnGap: length,
  gridColumnStart: { kind: 'grid-line' },
  gridGap: { ...length, items: 2 },
  gridRow: { kind: 'grid-line', items: 2 },
  gridRowEnd: { kind: 'grid-line' },
  gridRowGap: length,
  gridRowStart: { kind: 'grid-line' },
  gridTemplate: { kind: 'compound', property: 'gridTemplate' },
  gridTemplateAreas: { kind: 'compound', property: 'gridTemplateAreas' },
  gridTemplateColumns: {
    ...track,
    explicit: true,
  },
  gridTemplateRows: {
    ...track,
    explicit: true,
  },
  hangingPunctuation: {
    groups: [['first'], ['allow-end', 'force-end'], ['last']],
    kind: 'enum',
    values: ['allow-end', 'first', 'force-end', 'last', 'none'],
  },
  height: { ...size, functions: ['anchor-size', 'calc-size', 'fit-content'] },
  hyphenateCharacter: { kind: 'compound', property: 'hyphenateCharacter' },
  hyphenateLimitChars: {
    kind: 'tuple',
    atoms: ['integer'],
    keywords: ['auto'],
    min: 1,
    max: 3,
    negative: false,
  },
  hyphens: { kind: 'enum', values: ['auto', 'manual', 'none'] },
  imageOrientation: { kind: 'compound', property: 'imageOrientation' },
  imageRendering: {
    kind: 'enum',
    values: ['auto', 'crisp-edges', 'pixelated', 'smooth'],
  },
  imageResolution: { kind: 'compound', property: 'imageResolution' },
  imeMode: {
    kind: 'enum',
    values: ['active', 'auto', 'disabled', 'inactive', 'normal'],
  },
  initialLetter: { kind: 'compound', property: 'initialLetter' },
  initialLetterAlign: {
    kind: 'enum',
    values: ['alphabetic', 'auto', 'hanging', 'ideographic'],
  },
  inlineSize: {
    ...size,
    functions: ['anchor-size', 'calc-size', 'fit-content'],
  },
  inset: { ...margin, items: 4, functions: ['anchor', 'anchor-size'] },
  insetBlock: {
    ...margin,
    items: 2,
    functions: ['anchor', 'anchor-size'],
  },
  insetBlockEnd: { ...margin, functions: ['anchor', 'anchor-size'] },
  insetBlockStart: { ...margin, functions: ['anchor', 'anchor-size'] },
  insetInline: {
    ...margin,
    items: 2,
    functions: ['anchor', 'anchor-size'],
  },
  insetInlineEnd: { ...margin, functions: ['anchor', 'anchor-size'] },
  insetInlineStart: { ...margin, functions: ['anchor', 'anchor-size'] },
  interactivity: { kind: 'enum', values: ['auto', 'inert'] },
  interestDelay: {
    kind: 'tuple',
    atoms: ['time'],
    keywords: ['normal'],
    min: 1,
    max: 2,
    negative: false,
  },
  interestDelayEnd: { keywords: ['normal'], kind: 'time', negative: true },
  interestDelayStart: { keywords: ['normal'], kind: 'time', negative: true },
  interpolateSize: { kind: 'enum', values: ['allow-keywords', 'numeric-only'] },
  isolation: { kind: 'enum', values: ['auto', 'isolate'] },
  justifyContent: {
    kind: 'enum',
    values: [
      'center',
      'end',
      'flex-end',
      'flex-start',
      'left',
      'normal',
      'right',
      'safe center',
      'safe end',
      'safe flex-end',
      'safe flex-start',
      'safe left',
      'safe right',
      'safe start',
      'space-around',
      'space-between',
      'space-evenly',
      'start',
      'stretch',
      'unsafe center',
      'unsafe end',
      'unsafe flex-end',
      'unsafe flex-start',
      'unsafe left',
      'unsafe right',
      'unsafe start',
    ],
  },
  justifyItems: {
    kind: 'enum',
    values: [
      'anchor-center',
      'baseline',
      'center',
      'center legacy',
      'end',
      'first baseline',
      'flex-end',
      'flex-start',
      'last baseline',
      'left',
      'left legacy',
      'legacy',
      'legacy center',
      'legacy left',
      'legacy right',
      'normal',
      'right',
      'right legacy',
      'safe center',
      'safe end',
      'safe flex-end',
      'safe flex-start',
      'safe left',
      'safe right',
      'safe self-end',
      'safe self-start',
      'safe start',
      'self-end',
      'self-start',
      'start',
      'stretch',
      'unsafe center',
      'unsafe end',
      'unsafe flex-end',
      'unsafe flex-start',
      'unsafe left',
      'unsafe right',
      'unsafe self-end',
      'unsafe self-start',
      'unsafe start',
    ],
  },
  justifySelf: {
    kind: 'enum',
    values: [
      'anchor-center',
      'auto',
      'baseline',
      'center',
      'end',
      'first baseline',
      'flex-end',
      'flex-start',
      'last baseline',
      'left',
      'normal',
      'right',
      'safe center',
      'safe end',
      'safe flex-end',
      'safe flex-start',
      'safe left',
      'safe right',
      'safe self-end',
      'safe self-start',
      'safe start',
      'self-end',
      'self-start',
      'start',
      'stretch',
      'unsafe center',
      'unsafe end',
      'unsafe flex-end',
      'unsafe flex-start',
      'unsafe left',
      'unsafe right',
      'unsafe self-end',
      'unsafe self-start',
      'unsafe start',
    ],
  },
  justifyTracks: { kind: 'compound', property: 'justifyTracks' },
  left: { ...margin, functions: ['anchor', 'anchor-size'] },
  letterSpacing: textSpacing,
  lightingColor: color,
  lineBreak: {
    kind: 'enum',
    values: ['anywhere', 'auto', 'loose', 'normal', 'strict'],
  },
  lineClamp: {
    integer: true,
    keywords: ['none'],
    kind: 'number',
    max: Number.MAX_SAFE_INTEGER,
    min: 1,
  },
  lineHeight: {
    kind: 'number',
    length: true,
    percentage: true,
    max: Infinity,
    min: 0,
    keywords: ['normal'],
  },
  lineHeightStep: { ...length, percentage: false },
  linkParameters: { kind: 'compound', property: 'linkParameters' },
  listStyle: { kind: 'compound', property: 'listStyle' },
  listStyleImage: { kind: 'image' },
  listStylePosition: { kind: 'enum', values: ['inside', 'outside'] },
  listStyleType: {
    kind: 'identifier',
    keywords: [
      'armenian',
      'circle',
      'cjk-ideographic',
      'decimal',
      'decimal-leading-zero',
      'disc',
      'disclosure-closed',
      'disclosure-open',
      'georgian',
      'hebrew',
      'hiragana',
      'hiragana-iroha',
      'katakana',
      'katakana-iroha',
      'lower-alpha',
      'lower-greek',
      'lower-latin',
      'lower-roman',
      'none',
      'square',
      'upper-alpha',
      'upper-latin',
      'upper-roman',
    ],
  },
  margin: { ...margin, items: 4 },
  marginBlock: { ...margin, items: 2 },
  marginBlockEnd: margin,
  marginBlockStart: margin,
  marginBottom: margin,
  marginInline: { ...margin, items: 2 },
  marginInlineEnd: margin,
  marginInlineStart: margin,
  marginLeft: margin,
  marginRight: margin,
  marginTop: margin,
  marginTrim: { kind: 'enum', values: ['all', 'in-flow', 'none'] },
  marker: { kind: 'url' },
  markerEnd: { kind: 'url' },
  markerMid: { kind: 'url' },
  markerStart: { kind: 'url' },
  mask: { kind: 'compound', property: 'mask' },
  maskBorder: { kind: 'compound', property: 'maskBorder' },
  maskBorderMode: { kind: 'enum', values: ['alpha', 'luminance'] },
  maskBorderOutset: {
    kind: 'tuple',
    atoms: ['length', 'number'],
    min: 1,
    max: 4,
    negative: false,
  },
  maskBorderRepeat: {
    items: 2,
    kind: 'enum',
    values: ['repeat', 'round', 'space', 'stretch'],
  },
  maskBorderSlice: {
    kind: 'tuple',
    atoms: ['number', 'percentage'],
    marker: 'fill',
    markerPosition: 'last',
    min: 1,
    max: 4,
    negative: false,
  },
  maskBorderSource: { kind: 'image' },
  maskBorderWidth: {
    kind: 'tuple',
    atoms: ['length', 'number', 'percentage'],
    keywords: ['auto'],
    min: 1,
    max: 4,
    negative: false,
  },
  maskClip: {
    kind: 'enum',
    list: true,
    values: [
      'border-box',
      'content-box',
      'fill-box',
      'no-clip',
      'padding-box',
      'stroke-box',
      'view-box',
    ],
  },
  maskComposite: {
    kind: 'enum',
    list: true,
    values: ['add', 'exclude', 'intersect', 'subtract'],
  },
  maskImage: { kind: 'image', list: true },
  maskMode: {
    kind: 'enum',
    list: true,
    values: ['alpha', 'luminance', 'match-source'],
  },
  maskOrigin: {
    kind: 'enum',
    list: true,
    values: [
      'border-box',
      'content-box',
      'fill-box',
      'padding-box',
      'stroke-box',
      'view-box',
    ],
  },
  maskPosition: { kind: 'compound', property: 'maskPosition' },
  maskRepeat: {
    kind: 'enum',
    items: 2,
    list: true,
    values: ['no-repeat', 'repeat', 'repeat-x', 'repeat-y', 'round', 'space'],
  },
  maskSize: {
    ...length,
    auto: true,
    items: 2,
    list: true,
    keywords: ['contain', 'cover'],
  },
  maskType: { kind: 'enum', values: ['alpha', 'luminance'] },
  masonryAutoFlow: {
    groups: [
      ['next', 'pack'],
      ['definite-first', 'ordered'],
    ],
    kind: 'enum',
    values: ['definite-first', 'next', 'ordered', 'pack'],
  },
  mathDepth: { kind: 'compound', property: 'mathDepth' },
  mathShift: { kind: 'enum', values: ['compact', 'normal'] },
  mathStyle: { kind: 'enum', values: ['compact', 'normal'] },
  maxBlockSize: {
    ...maximum,
    functions: ['anchor-size', 'calc-size', 'fit-content'],
  },
  maxHeight: {
    ...maximum,
    functions: ['anchor-size', 'calc-size', 'fit-content'],
  },
  maxInlineSize: {
    ...maximum,
    functions: ['anchor-size', 'calc-size', 'fit-content'],
  },
  maxLines: {
    integer: true,
    keywords: ['none'],
    kind: 'number',
    max: Number.MAX_SAFE_INTEGER,
    min: 1,
  },
  maxWidth: {
    ...maximum,
    functions: ['anchor-size', 'calc-size', 'fit-content'],
  },
  minBlockSize: {
    ...size,
    functions: ['anchor-size', 'calc-size', 'fit-content'],
  },
  minHeight: {
    ...size,
    functions: ['anchor-size', 'calc-size', 'fit-content'],
  },
  minInlineSize: {
    ...size,
    functions: ['anchor-size', 'calc-size', 'fit-content'],
  },
  minWidth: { ...size, functions: ['anchor-size', 'calc-size', 'fit-content'] },
  mixBlendMode: {
    kind: 'enum',
    values: [
      'color',
      'color-burn',
      'color-dodge',
      'darken',
      'difference',
      'exclusion',
      'hard-light',
      'hue',
      'lighten',
      'luminosity',
      'multiply',
      'normal',
      'overlay',
      'plus-darker',
      'plus-lighter',
      'saturation',
      'screen',
      'soft-light',
    ],
  },
  MozAnimationName: {
    keywords: ['none'],
    kind: 'identifier',
    separator: 'comma',
  },
  MozAppearance: {
    kind: 'enum',
    values: [
      '-moz-mac-unified-toolbar',
      '-moz-win-borderless-glass',
      '-moz-win-browsertabbar-toolbox',
      '-moz-win-communications-toolbox',
      '-moz-win-communicationstext',
      '-moz-win-exclude-glass',
      '-moz-win-glass',
      '-moz-win-media-toolbox',
      '-moz-win-mediatext',
      '-moz-window-button-box',
      '-moz-window-button-box-maximized',
      '-moz-window-button-close',
      '-moz-window-button-maximize',
      '-moz-window-button-minimize',
      '-moz-window-button-restore',
      '-moz-window-frame-bottom',
      '-moz-window-frame-left',
      '-moz-window-frame-right',
      '-moz-window-titlebar',
      '-moz-window-titlebar-maximized',
      'button',
      'button-arrow-down',
      'button-arrow-next',
      'button-arrow-previous',
      'button-arrow-up',
      'button-bevel',
      'button-focus',
      'caret',
      'checkbox',
      'checkbox-container',
      'checkbox-label',
      'checkmenuitem',
      'dualbutton',
      'groupbox',
      'listbox',
      'listitem',
      'menuarrow',
      'menubar',
      'menucheckbox',
      'menuimage',
      'menuitem',
      'menuitemtext',
      'menulist',
      'menulist-button',
      'menulist-text',
      'menulist-textfield',
      'menupopup',
      'menuradio',
      'menuseparator',
      'meterbar',
      'meterchunk',
      'none',
      'progressbar',
      'progressbar-vertical',
      'progresschunk',
      'progresschunk-vertical',
      'radio',
      'radio-container',
      'radio-label',
      'radiomenuitem',
      'range',
      'range-thumb',
      'resizer',
      'resizerpanel',
      'scale-horizontal',
      'scale-vertical',
      'scalethumb-horizontal',
      'scalethumb-vertical',
      'scalethumbend',
      'scalethumbstart',
      'scalethumbtick',
      'scrollbarbutton-down',
      'scrollbarbutton-left',
      'scrollbarbutton-right',
      'scrollbarbutton-up',
      'scrollbarthumb-horizontal',
      'scrollbarthumb-vertical',
      'scrollbartrack-horizontal',
      'scrollbartrack-vertical',
      'searchfield',
      'separator',
      'sheet',
      'spinner',
      'spinner-downbutton',
      'spinner-textfield',
      'spinner-upbutton',
      'splitter',
      'statusbar',
      'statusbarpanel',
      'tab',
      'tab-scroll-arrow-back',
      'tab-scroll-arrow-forward',
      'tabpanel',
      'tabpanels',
      'textfield',
      'textfield-multiline',
      'toolbar',
      'toolbarbutton',
      'toolbarbutton-dropdown',
      'toolbargripper',
      'toolbox',
      'tooltip',
      'treeheader',
      'treeheadercell',
      'treeheadersortarrow',
      'treeitem',
      'treeline',
      'treetwisty',
      'treetwistyopen',
      'treeview',
    ],
  },
  MozBackgroundClip: {
    kind: 'enum',
    list: true,
    values: [
      'border-area',
      'border-box',
      'content-box',
      'padding-box',
      'text',
      'border',
      'padding',
      'content',
    ],
  },
  MozBackgroundOrigin: {
    kind: 'enum',
    list: true,
    values: [
      'border-box',
      'content-box',
      'padding-box',
      'border',
      'padding',
      'content',
    ],
  },
  MozBinding: { kind: 'url' },
  MozBorderBottomColors: {
    kind: 'tuple',
    atoms: ['color'],
    standalone: ['none'],
    min: 1,
    max: Infinity,
    negative: false,
  },
  MozBorderLeftColors: {
    kind: 'tuple',
    atoms: ['color'],
    standalone: ['none'],
    min: 1,
    max: Infinity,
    negative: false,
  },
  MozBorderRightColors: {
    kind: 'tuple',
    atoms: ['color'],
    standalone: ['none'],
    min: 1,
    max: Infinity,
    negative: false,
  },
  MozBorderTopColors: {
    kind: 'tuple',
    atoms: ['color'],
    standalone: ['none'],
    min: 1,
    max: Infinity,
    negative: false,
  },
  MozContextProperties: { kind: 'compound', property: 'MozContextProperties' },
  MozFloatEdge: {
    kind: 'enum',
    values: ['border-box', 'content-box', 'margin-box', 'padding-box'],
  },
  MozFontLanguageOverride: {
    kind: 'compound',
    property: 'fontLanguageOverride',
  },
  MozForceBrokenImageIcon: {
    kind: 'compound',
    property: 'MozForceBrokenImageIcon',
  },
  MozOrient: {
    kind: 'enum',
    values: ['block', 'horizontal', 'inline', 'vertical'],
  },
  MozOsxFontSmoothing: { kind: 'enum', values: ['auto', 'grayscale'] },
  MozOutlineRadius: { ...length, axes: true, items: 4 },
  MozOutlineRadiusBottomleft: length,
  MozOutlineRadiusBottomright: length,
  MozOutlineRadiusTopleft: length,
  MozOutlineRadiusTopright: length,
  MozStackSizing: { kind: 'enum', values: ['ignore', 'stretch-to-fit'] },
  MozTextBlink: { kind: 'enum', values: ['blink', 'none'] },
  MozUserFocus: {
    kind: 'enum',
    values: [
      'ignore',
      'none',
      'normal',
      'select-after',
      'select-all',
      'select-before',
      'select-menu',
      'select-same',
    ],
  },
  MozUserInput: {
    kind: 'enum',
    values: ['auto', 'disabled', 'enabled', 'none'],
  },
  MozUserModify: {
    kind: 'enum',
    values: ['read-only', 'read-write', 'write-only'],
  },
  MozWindowDragging: { kind: 'enum', values: ['drag', 'no-drag'] },
  MozWindowShadow: {
    kind: 'enum',
    values: ['default', 'menu', 'none', 'sheet', 'tooltip'],
  },
  MsAccelerator: { kind: 'enum', values: ['false', 'true'] },
  MsBlockProgression: { kind: 'enum', values: ['bt', 'lr', 'rl', 'tb'] },
  MsContentZoomChaining: { kind: 'enum', values: ['chained', 'none'] },
  MsContentZooming: { kind: 'enum', values: ['none', 'zoom'] },
  MsContentZoomLimit: { kind: 'compound', property: 'MsContentZoomLimit' },
  MsContentZoomLimitMax: { kind: 'percentage', min: 0, max: Infinity },
  MsContentZoomLimitMin: { kind: 'percentage', min: 0, max: Infinity },
  MsContentZoomSnap: { kind: 'compound', property: 'MsContentZoomSnap' },
  MsContentZoomSnapPoints: {
    kind: 'compound',
    property: 'MsContentZoomSnapPoints',
  },
  MsContentZoomSnapType: {
    kind: 'enum',
    values: ['mandatory', 'none', 'proximity'],
  },
  MsFilter: { kind: 'compound', property: 'MsFilter' },
  MsFlowFrom: { kind: 'compound', property: 'MsFlowFrom' },
  MsFlowInto: { kind: 'compound', property: 'MsFlowInto' },
  MsGridColumns: { kind: 'compound', property: 'MsGridColumns' },
  MsGridRows: { kind: 'compound', property: 'MsGridRows' },
  MsHighContrastAdjust: { kind: 'enum', values: ['auto', 'none'] },
  MsHyphenateLimitChars: {
    kind: 'tuple',
    atoms: ['integer'],
    standalone: ['auto'],
    min: 1,
    max: 3,
    negative: false,
  },
  MsHyphenateLimitLines: {
    kind: 'compound',
    property: 'MsHyphenateLimitLines',
  },
  MsHyphenateLimitZone: length,
  MsImeAlign: { kind: 'enum', values: ['after', 'auto'] },
  MsOverflowStyle: {
    kind: 'enum',
    values: ['-ms-autohiding-scrollbar', 'auto', 'none', 'scrollbar'],
  },
  MsScrollbar3dlightColor: color,
  MsScrollbarArrowColor: color,
  MsScrollbarBaseColor: color,
  MsScrollbarDarkshadowColor: color,
  MsScrollbarFaceColor: color,
  MsScrollbarHighlightColor: color,
  MsScrollbarShadowColor: color,
  MsScrollbarTrackColor: color,
  MsScrollChaining: { kind: 'enum', values: ['chained', 'none'] },
  MsScrollLimit: { kind: 'compound', property: 'MsScrollLimit' },
  MsScrollLimitXMax: { ...stroke, auto: true },
  MsScrollLimitXMin: stroke,
  MsScrollLimitYMax: { ...stroke, auto: true },
  MsScrollLimitYMin: stroke,
  MsScrollRails: { kind: 'enum', values: ['none', 'railed'] },
  MsScrollSnapPointsX: { kind: 'compound', property: 'MsScrollSnapPointsX' },
  MsScrollSnapPointsY: { kind: 'compound', property: 'MsScrollSnapPointsY' },
  MsScrollSnapType: {
    kind: 'enum',
    values: ['mandatory', 'none', 'proximity'],
  },
  MsScrollSnapX: { kind: 'compound', property: 'MsScrollSnapX' },
  MsScrollSnapY: { kind: 'compound', property: 'MsScrollSnapY' },
  MsScrollTranslation: {
    kind: 'enum',
    values: ['none', 'vertical-to-horizontal'],
  },
  MsTextAutospace: {
    kind: 'enum',
    values: [
      'ideograph-alpha',
      'ideograph-numeric',
      'ideograph-parenthesis',
      'ideograph-space',
      'none',
    ],
  },
  MsTouchSelect: { kind: 'enum', values: ['grippers', 'none'] },
  MsUserSelect: { kind: 'enum', values: ['element', 'none', 'text'] },
  MsWrapFlow: {
    kind: 'enum',
    values: ['auto', 'both', 'clear', 'end', 'maximum', 'start'],
  },
  MsWrapMargin: stroke,
  MsWrapThrough: { kind: 'enum', values: ['none', 'wrap'] },
  OAnimationName: {
    keywords: ['none'],
    kind: 'identifier',
    separator: 'comma',
  },
  objectFit: {
    kind: 'enum',
    values: ['contain', 'cover', 'fill', 'none', 'scale-down'],
  },
  objectPosition: { kind: 'compound', property: 'objectPosition' },
  objectViewBox: { kind: 'compound', property: 'objectViewBox' },
  offset: { kind: 'compound', property: 'offset' },
  offsetAnchor: { kind: 'compound', property: 'offsetAnchor' },
  offsetDistance: { ...length, negative: true },
  offsetPath: { kind: 'compound', property: 'offsetPath' },
  offsetPosition: { kind: 'compound', property: 'offsetPosition' },
  offsetRotate: { kind: 'compound', property: 'offsetRotate' },
  opacity: alpha,
  // Safe integers serialize without exponential notation in CSS integer positions.
  order: {
    integer: true,
    kind: 'number',
    max: Number.MAX_SAFE_INTEGER,
    min: Number.MIN_SAFE_INTEGER,
  },
  orphans: positiveInteger,
  outline: { kind: 'line', outline: true },
  outlineColor: { ...color, keywords: ['auto'] },
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
  outlineWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
  overflow: { ...overflow, items: 2 },
  overflowAnchor: { kind: 'enum', values: ['auto', 'none'] },
  overflowBlock: {
    kind: 'enum',
    values: ['auto', 'clip', 'hidden', 'scroll', 'visible'],
  },
  overflowClipBox: { kind: 'enum', values: ['content-box', 'padding-box'] },
  overflowClipMargin: { kind: 'compound', property: 'overflowClipMargin' },
  overflowInline: {
    kind: 'enum',
    values: ['auto', 'clip', 'hidden', 'scroll', 'visible'],
  },
  overflowWrap: { kind: 'enum', values: ['anywhere', 'break-word', 'normal'] },
  overflowX: overflow,
  overflowY: overflow,
  overlay: { kind: 'enum', values: ['auto', 'none'] },
  overscrollBehavior: { ...overscroll, items: 2 },
  overscrollBehaviorBlock: {
    kind: 'enum',
    values: ['auto', 'contain', 'none'],
  },
  overscrollBehaviorInline: {
    kind: 'enum',
    values: ['auto', 'contain', 'none'],
  },
  overscrollBehaviorX: overscroll,
  overscrollBehaviorY: overscroll,
  padding: { ...length, items: 4 },
  paddingBlock: { ...length, items: 2 },
  paddingBlockEnd: length,
  paddingBlockStart: length,
  paddingBottom: length,
  paddingInline: { ...length, items: 2 },
  paddingInlineEnd: length,
  paddingInlineStart: length,
  paddingLeft: length,
  paddingRight: length,
  paddingTop: length,
  page: { keywords: ['auto'], kind: 'identifier' },
  pageBreakAfter: {
    kind: 'enum',
    values: ['always', 'auto', 'avoid', 'left', 'recto', 'right', 'verso'],
  },
  pageBreakBefore: {
    kind: 'enum',
    values: ['always', 'auto', 'avoid', 'left', 'recto', 'right', 'verso'],
  },
  pageBreakInside: { kind: 'enum', values: ['auto', 'avoid'] },
  paintOrder: {
    kind: 'enum',
    groups: [['fill'], ['stroke'], ['markers']],
    values: ['fill', 'markers', 'normal', 'stroke'],
  },
  pathLength: { kind: 'compound', property: 'pathLength' },
  perspective: { ...length, keywords: ['none'], percentage: false },
  perspectiveOrigin: { kind: 'compound', property: 'perspectiveOrigin' },
  placeContent: { kind: 'compound', property: 'placeContent' },
  placeItems: { kind: 'compound', property: 'placeItems' },
  placeSelf: { kind: 'compound', property: 'placeSelf' },
  pointerEvents: {
    kind: 'enum',
    values: [
      'all',
      'auto',

      'fill',
      'none',
      'painted',
      'stroke',
      'visible',
      'visibleFill',
      'visiblePainted',
      'visibleStroke',
    ],
  },
  position: {
    kind: 'enum',
    values: ['absolute', 'fixed', 'relative', 'static', 'sticky'],
  },
  positionAnchor: {
    dashed: true,
    keywords: ['auto', 'match-parent', 'none', 'normal'],
    kind: 'identifier',
  },
  positionArea: { kind: 'compound', property: 'positionArea' },
  positionTry: { kind: 'compound', property: 'positionTry' },
  positionTryFallbacks: { kind: 'compound', property: 'positionTryFallbacks' },
  positionTryOrder: {
    kind: 'enum',
    values: [
      'most-block-size',
      'most-height',
      'most-inline-size',
      'most-width',
      'normal',
    ],
  },
  positionVisibility: {
    groups: [['anchors-valid'], ['anchors-visible'], ['no-overflow']],
    kind: 'enum',
    values: ['always', 'anchors-valid', 'anchors-visible', 'no-overflow'],
  },
  printColorAdjust: { kind: 'enum', values: ['economy', 'exact'] },
  quotes: { kind: 'compound', property: 'quotes' },
  r: length,
  readingFlow: {
    kind: 'enum',
    values: [
      'flex-flow',
      'flex-visual',
      'grid-columns',
      'grid-order',
      'grid-rows',
      'normal',
      'source-order',
    ],
  },
  readingOrder: {
    integer: true,
    kind: 'number',
    max: Number.MAX_SAFE_INTEGER,
    min: Number.MIN_SAFE_INTEGER,
  },
  resize: {
    kind: 'enum',
    values: ['block', 'both', 'horizontal', 'inline', 'none', 'vertical'],
  },
  right: { ...margin, functions: ['anchor', 'anchor-size'] },
  rotate: { kind: 'rotate' },
  rowGap: { ...length, keywords: ['normal'] },
  rowRule: { kind: 'compound', property: 'rowRule', negative: false },
  rowRuleBreak: { kind: 'enum', values: ['none', 'normal', 'intersection'] },
  rowRuleColor: { kind: 'compound', property: 'rowRuleColor' },
  rowRuleInset: { kind: 'compound', property: 'ruleInset' },
  rowRuleInsetCap: {
    ...length,
    negative: true,
    items: 2,
    keywords: ['overlap-join'],
  },
  rowRuleInsetCapEnd: { ...length, negative: true, keywords: ['overlap-join'] },
  rowRuleInsetCapStart: {
    ...length,
    negative: true,
    keywords: ['overlap-join'],
  },
  rowRuleInsetEnd: { ...length, negative: true, keywords: ['overlap-join'] },
  rowRuleInsetJunction: {
    ...length,
    negative: true,
    items: 2,
    keywords: ['overlap-join'],
  },
  rowRuleInsetJunctionEnd: {
    ...length,
    negative: true,
    keywords: ['overlap-join'],
  },
  rowRuleInsetJunctionStart: {
    ...length,
    negative: true,
    keywords: ['overlap-join'],
  },
  rowRuleInsetStart: { ...length, negative: true, keywords: ['overlap-join'] },
  rowRuleStyle: { kind: 'compound', property: 'rowRuleStyle' },
  rowRuleVisibilityItems: {
    kind: 'enum',
    values: ['all', 'around', 'between', 'normal'],
  },
  rowRuleWidth: { kind: 'compound', property: 'rowRuleWidth', negative: false },
  rubyAlign: {
    kind: 'enum',
    values: ['center', 'space-around', 'space-between', 'start'],
  },
  rubyMerge: { kind: 'enum', values: ['auto', 'collapse', 'separate'] },
  rubyOverhang: { kind: 'enum', values: ['auto', 'none'] },
  rubyPosition: {
    kind: 'enum',
    values: [
      'alternate',
      'alternate over',
      'alternate under',
      'inter-character',
      'over',
      'over alternate',
      'under',
      'under alternate',
    ],
  },
  rule: { kind: 'compound', property: 'rowRule', negative: false },
  ruleBreak: { kind: 'enum', values: ['none', 'normal', 'intersection'] },
  ruleColor: { kind: 'compound', property: 'rowRuleColor' },
  ruleInset: { kind: 'compound', property: 'ruleInset' },
  ruleInsetCap: {
    ...length,
    negative: true,
    items: 2,
    keywords: ['overlap-join'],
  },
  ruleInsetEnd: { ...length, negative: true, keywords: ['overlap-join'] },
  ruleInsetJunction: {
    ...length,
    negative: true,
    items: 2,
    keywords: ['overlap-join'],
  },
  ruleInsetStart: { ...length, negative: true, keywords: ['overlap-join'] },
  ruleOverlap: { kind: 'enum', values: ['row-over-column', 'column-over-row'] },
  ruleStyle: { kind: 'compound', property: 'rowRuleStyle' },
  ruleVisibilityItems: {
    kind: 'enum',
    values: ['all', 'around', 'between', 'normal'],
  },
  ruleWidth: { kind: 'compound', property: 'rowRuleWidth', negative: false },
  rx: { ...length, auto: true },
  ry: { ...length, auto: true },
  scale: { kind: 'scale' },
  scrollAxisLock: { kind: 'enum', values: ['auto', 'none'] },
  scrollbarColor: {
    kind: 'tuple',
    atoms: ['color'],
    standalone: ['auto'],
    min: 2,
    max: 2,
    negative: false,
  },
  scrollbarGutter: {
    kind: 'enum',
    values: ['auto', 'both-edges stable', 'stable', 'stable both-edges'],
  },
  scrollbarWidth: { kind: 'enum', values: ['auto', 'none', 'thin'] },
  scrollBehavior: { kind: 'enum', values: ['auto', 'smooth'] },
  scrollInitialTarget: { kind: 'enum', values: ['nearest', 'none'] },
  scrollMargin: { ...scrollMargin, items: 4 },
  scrollMarginBlock: { ...scrollMargin, items: 2 },
  scrollMarginBlockEnd: scrollMargin,
  scrollMarginBlockStart: scrollMargin,
  scrollMarginBottom: scrollMargin,
  scrollMarginInline: { ...scrollMargin, items: 2 },
  scrollMarginInlineEnd: scrollMargin,
  scrollMarginInlineStart: scrollMargin,
  scrollMarginLeft: scrollMargin,
  scrollMarginRight: scrollMargin,
  scrollMarginTop: scrollMargin,
  scrollMarkerGroup: { kind: 'enum', values: ['after', 'before', 'none'] },
  scrollPadding: { ...scrollPadding, items: 4 },
  scrollPaddingBlock: { ...scrollPadding, items: 2 },
  scrollPaddingBlockEnd: scrollPadding,
  scrollPaddingBlockStart: scrollPadding,
  scrollPaddingBottom: scrollPadding,
  scrollPaddingInline: { ...scrollPadding, items: 2 },
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
  scrollSnapCoordinate: { kind: 'compound', property: 'scrollSnapCoordinate' },
  scrollSnapDestination: {
    kind: 'compound',
    property: 'scrollSnapDestination',
  },
  scrollSnapPointsX: { kind: 'compound', property: 'scrollSnapPointsX' },
  scrollSnapPointsY: { kind: 'compound', property: 'scrollSnapPointsY' },
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
  scrollSnapTypeX: { kind: 'enum', values: ['mandatory', 'none', 'proximity'] },
  scrollSnapTypeY: { kind: 'enum', values: ['mandatory', 'none', 'proximity'] },
  scrollTargetGroup: { kind: 'enum', values: ['auto', 'none'] },
  scrollTimeline: { kind: 'compound', property: 'scrollTimeline' },
  scrollTimelineAxis: {
    kind: 'enum',
    list: true,
    values: ['block', 'inline', 'x', 'y'],
  },
  scrollTimelineName: {
    dashed: true,
    keywords: ['none'],
    kind: 'identifier',
    separator: 'comma',
  },
  shapeImageThreshold: alpha,
  shapeMargin: length,
  shapeOutside: { kind: 'compound', property: 'shapeOutside' },
  shapeRendering: {
    kind: 'enum',
    values: ['auto', 'crispEdges', 'geometricPrecision', 'optimizeSpeed'],
  },
  speak: { kind: 'enum', values: ['auto', 'never', 'always'] },
  speakAs: {
    groups: [
      ['spell-out'],
      ['digits'],
      ['literal-punctuation', 'no-punctuation'],
    ],
    kind: 'enum',
    values: [
      'digits',
      'literal-punctuation',
      'no-punctuation',
      'normal',
      'spell-out',
    ],
  },
  stopColor: color,
  stopOpacity: alpha,
  stroke: {
    ...color,
    keywords: ['context-fill', 'context-stroke', 'none'],
    paint: true,
  },
  strokeColor: color,
  strokeDasharray: { kind: 'compound', property: 'strokeDasharray' },
  strokeDashoffset: { ...length, negative: true, numeric: true },
  strokeLinecap: { kind: 'enum', values: ['butt', 'round', 'square'] },
  strokeLinejoin: {
    kind: 'enum',
    values: ['arcs', 'bevel', 'miter', 'miter-clip', 'round'],
  },
  strokeMiterlimit: { kind: 'number', max: Infinity, min: 1 },
  strokeOpacity: alpha,
  strokeWidth: { ...length, numeric: true },
  tableLayout: { kind: 'enum', values: ['auto', 'fixed'] },
  tabSize: {
    integer: true,
    length: true,
    kind: 'number',
    max: Number.MAX_SAFE_INTEGER,
    min: 0,
  },
  textAlign: {
    kind: 'enum',
    values: [
      'center',
      'end',
      'justify',
      'left',
      'match-parent',
      'right',
      'start',
    ],
  },
  textAlignLast: {
    kind: 'enum',
    values: ['auto', 'center', 'end', 'justify', 'left', 'right', 'start'],
  },
  textAnchor: { kind: 'enum', values: ['end', 'middle', 'start'] },
  textAutospace: { kind: 'compound', property: 'textAutospace' },
  textBox: { kind: 'compound', property: 'textBox' },
  textBoxEdge: {
    kind: 'enum',
    values: [
      'auto',
      'cap',
      'cap alphabetic',
      'cap ideographic',
      'cap ideographic-ink',
      'cap text',
      'ex',
      'ex alphabetic',
      'ex ideographic',
      'ex ideographic-ink',
      'ex text',
      'ideographic',
      'ideographic alphabetic',
      'ideographic ideographic',
      'ideographic ideographic-ink',
      'ideographic text',
      'ideographic-ink',
      'ideographic-ink alphabetic',
      'ideographic-ink ideographic',
      'ideographic-ink ideographic-ink',
      'ideographic-ink text',
      'text',
      'text alphabetic',
      'text ideographic',
      'text ideographic-ink',
      'text text',
    ],
  },
  textBoxTrim: {
    kind: 'enum',
    values: ['none', 'trim-both', 'trim-end', 'trim-start'],
  },
  textCombineUpright: {
    kind: 'compound',
    property: 'textCombineUpright',
    negative: false,
  },
  textDecoration: { kind: 'compound', property: 'textDecoration' },
  textDecorationColor: color,
  textDecorationInset: {
    ...length,
    auto: true,
    items: 2,
    negative: true,
    standalone: ['auto'],
  },
  textDecorationLine: {
    kind: 'enum',
    values: [
      'blink',
      'blink line-through',
      'blink line-through overline',
      'blink line-through overline underline',
      'blink line-through underline',
      'blink line-through underline overline',
      'blink overline',
      'blink overline line-through',
      'blink overline line-through underline',
      'blink overline underline',
      'blink overline underline line-through',
      'blink underline',
      'blink underline line-through',
      'blink underline line-through overline',
      'blink underline overline',
      'blink underline overline line-through',
      'grammar-error',
      'line-through',
      'line-through blink',
      'line-through blink overline',
      'line-through blink overline underline',
      'line-through blink underline',
      'line-through blink underline overline',
      'line-through overline',
      'line-through overline blink',
      'line-through overline blink underline',
      'line-through overline underline',
      'line-through overline underline blink',
      'line-through underline',
      'line-through underline blink',
      'line-through underline blink overline',
      'line-through underline overline',
      'line-through underline overline blink',
      'none',
      'overline',
      'overline blink',
      'overline blink line-through',
      'overline blink line-through underline',
      'overline blink underline',
      'overline blink underline line-through',
      'overline line-through',
      'overline line-through blink',
      'overline line-through blink underline',
      'overline line-through underline',
      'overline line-through underline blink',
      'overline underline',
      'overline underline blink',
      'overline underline blink line-through',
      'overline underline line-through',
      'overline underline line-through blink',
      'spelling-error',
      'underline',
      'underline blink',
      'underline blink line-through',
      'underline blink line-through overline',
      'underline blink overline',
      'underline blink overline line-through',
      'underline line-through',
      'underline line-through blink',
      'underline line-through blink overline',
      'underline line-through overline',
      'underline line-through overline blink',
      'underline overline',
      'underline overline blink',
      'underline overline blink line-through',
      'underline overline line-through',
      'underline overline line-through blink',
    ],
  },
  textDecorationSkip: { kind: 'compound', property: 'textDecorationSkip' },
  textDecorationSkipInk: { kind: 'enum', values: ['all', 'auto', 'none'] },
  textDecorationSkipSpaces: {
    kind: 'enum',
    values: ['none', 'all', 'start', 'end'],
    groups: [['start'], ['end']],
  },
  textDecorationStyle: {
    kind: 'enum',
    values: ['dashed', 'dotted', 'double', 'solid', 'wavy'],
  },
  textDecorationThickness: { ...length, auto: true, keywords: ['from-font'] },
  textEmphasis: { kind: 'compound', property: 'textEmphasis' },
  textEmphasisColor: color,
  textEmphasisPosition: {
    kind: 'enum',
    values: [
      'auto',
      'left over',
      'left under',
      'over',
      'over left',
      'over right',
      'right over',
      'right under',
      'under',
      'under left',
      'under right',
    ],
  },
  textEmphasisStyle: {
    kind: 'enum',
    quoted: true,
    values: [
      'circle',
      'circle filled',
      'circle open',
      'dot',
      'dot filled',
      'dot open',
      'double-circle',
      'double-circle filled',
      'double-circle open',
      'filled',
      'filled circle',
      'filled dot',
      'filled double-circle',
      'filled sesame',
      'filled triangle',
      'none',
      'open',
      'open circle',
      'open dot',
      'open double-circle',
      'open sesame',
      'open triangle',
      'sesame',
      'sesame filled',
      'sesame open',
      'triangle',
      'triangle filled',
      'triangle open',
    ],
  },
  textFit: { kind: 'compound', property: 'textFit' },
  textIndent: { kind: 'compound', property: 'textIndent' },
  textJustify: {
    kind: 'enum',
    values: ['auto', 'inter-character', 'inter-word', 'none'],
  },
  textOrientation: { kind: 'enum', values: ['mixed', 'sideways', 'upright'] },
  textOverflow: {
    kind: 'enum',
    quoted: true,
    items: 2,
    values: ['clip', 'ellipsis'],
  },
  textRendering: {
    kind: 'enum',
    values: [
      'auto',
      'geometricPrecision',
      'optimizeLegibility',
      'optimizeSpeed',
    ],
  },
  textShadow: { kind: 'compound', property: 'textShadow' },
  textSizeAdjust: {
    kind: 'percentage',
    min: 0,
    max: Infinity,
    keywords: ['auto', 'none'],
  },
  textSpacingTrim: {
    kind: 'enum',
    values: ['normal', 'space-all', 'space-first', 'trim-start'],
  },
  textTransform: {
    kind: 'enum',
    values: [
      'capitalize',
      'capitalize full-size-kana',
      'capitalize full-size-kana full-width',
      'capitalize full-width',
      'capitalize full-width full-size-kana',
      'full-size-kana',
      'full-size-kana capitalize',
      'full-size-kana capitalize full-width',
      'full-size-kana full-width',
      'full-size-kana full-width capitalize',
      'full-size-kana full-width lowercase',
      'full-size-kana full-width uppercase',
      'full-size-kana lowercase',
      'full-size-kana lowercase full-width',
      'full-size-kana uppercase',
      'full-size-kana uppercase full-width',
      'full-width',
      'full-width capitalize',
      'full-width capitalize full-size-kana',
      'full-width full-size-kana',
      'full-width full-size-kana capitalize',
      'full-width full-size-kana lowercase',
      'full-width full-size-kana uppercase',
      'full-width lowercase',
      'full-width lowercase full-size-kana',
      'full-width uppercase',
      'full-width uppercase full-size-kana',
      'lowercase',
      'lowercase full-size-kana',
      'lowercase full-size-kana full-width',
      'lowercase full-width',
      'lowercase full-width full-size-kana',
      'math-auto',
      'none',
      'uppercase',
      'uppercase full-size-kana',
      'uppercase full-size-kana full-width',
      'uppercase full-width',
      'uppercase full-width full-size-kana',
    ],
  },
  textUnderlineOffset: { ...length, auto: true, negative: true },
  textUnderlinePosition: {
    groups: [['under'], ['left', 'right']],
    kind: 'enum',
    values: ['auto', 'from-font', 'left', 'right', 'under'],
  },
  textWrap: {
    groups: [
      ['nowrap', 'wrap'],
      ['auto', 'balance', 'pretty', 'stable'],
    ],
    kind: 'enum',
    values: ['auto', 'balance', 'nowrap', 'pretty', 'stable', 'wrap'],
  },
  textWrapMode: { kind: 'enum', values: ['nowrap', 'wrap'] },
  textWrapStyle: {
    kind: 'enum',
    values: ['auto', 'balance', 'pretty', 'stable'],
  },
  timelineScope: {
    dashed: true,
    keywords: ['none'],
    kind: 'identifier',
    separator: 'comma',
    standalone: ['none'],
  },
  timelineTrigger: { kind: 'compound', property: 'timelineTrigger' },
  timelineTriggerActivationRange: {
    kind: 'compound',
    property: 'timelineTriggerActivationRange',
  },
  timelineTriggerActivationRangeEnd: attachmentRange,
  timelineTriggerActivationRangeStart: attachmentRange,
  timelineTriggerActiveRange: {
    kind: 'compound',
    property: 'timelineTriggerActiveRange',
  },
  timelineTriggerActiveRangeEnd: {
    ...attachmentRange,
    standalone: [...attachmentRange.standalone, 'auto'],
  },
  timelineTriggerActiveRangeStart: {
    ...attachmentRange,
    standalone: [...attachmentRange.standalone, 'auto'],
  },
  timelineTriggerName: {
    dashed: true,
    keywords: ['none'],
    kind: 'identifier',
    separator: 'comma',
    standalone: ['none'],
  },
  timelineTriggerSource: {
    dashed: true,
    keywords: ['auto', 'none'],
    kind: 'identifier',
    separator: 'comma',
  },
  top: { ...margin, functions: ['anchor', 'anchor-size'] },
  touchAction: {
    kind: 'enum',
    values: [
      'auto',
      'manipulation',
      'none',
      'pan-down',
      'pan-down pan-left',
      'pan-down pan-left pinch-zoom',
      'pan-down pan-right',
      'pan-down pan-right pinch-zoom',
      'pan-down pan-x',
      'pan-down pan-x pinch-zoom',
      'pan-down pinch-zoom',
      'pan-down pinch-zoom pan-left',
      'pan-down pinch-zoom pan-right',
      'pan-down pinch-zoom pan-x',
      'pan-left',
      'pan-left pan-down',
      'pan-left pan-down pinch-zoom',
      'pan-left pan-up',
      'pan-left pan-up pinch-zoom',
      'pan-left pan-y',
      'pan-left pan-y pinch-zoom',
      'pan-left pinch-zoom',
      'pan-left pinch-zoom pan-down',
      'pan-left pinch-zoom pan-up',
      'pan-left pinch-zoom pan-y',
      'pan-right',
      'pan-right pan-down',
      'pan-right pan-down pinch-zoom',
      'pan-right pan-up',
      'pan-right pan-up pinch-zoom',
      'pan-right pan-y',
      'pan-right pan-y pinch-zoom',
      'pan-right pinch-zoom',
      'pan-right pinch-zoom pan-down',
      'pan-right pinch-zoom pan-up',
      'pan-right pinch-zoom pan-y',
      'pan-up',
      'pan-up pan-left',
      'pan-up pan-left pinch-zoom',
      'pan-up pan-right',
      'pan-up pan-right pinch-zoom',
      'pan-up pan-x',
      'pan-up pan-x pinch-zoom',
      'pan-up pinch-zoom',
      'pan-up pinch-zoom pan-left',
      'pan-up pinch-zoom pan-right',
      'pan-up pinch-zoom pan-x',
      'pan-x',
      'pan-x pan-down',
      'pan-x pan-down pinch-zoom',
      'pan-x pan-up',
      'pan-x pan-up pinch-zoom',
      'pan-x pan-y',
      'pan-x pan-y pinch-zoom',
      'pan-x pinch-zoom',
      'pan-x pinch-zoom pan-down',
      'pan-x pinch-zoom pan-up',
      'pan-x pinch-zoom pan-y',
      'pan-y',
      'pan-y pan-left',
      'pan-y pan-left pinch-zoom',
      'pan-y pan-right',
      'pan-y pan-right pinch-zoom',
      'pan-y pan-x',
      'pan-y pan-x pinch-zoom',
      'pan-y pinch-zoom',
      'pan-y pinch-zoom pan-left',
      'pan-y pinch-zoom pan-right',
      'pan-y pinch-zoom pan-x',
      'pinch-zoom',
      'pinch-zoom pan-down',
      'pinch-zoom pan-down pan-left',
      'pinch-zoom pan-down pan-right',
      'pinch-zoom pan-down pan-x',
      'pinch-zoom pan-left',
      'pinch-zoom pan-left pan-down',
      'pinch-zoom pan-left pan-up',
      'pinch-zoom pan-left pan-y',
      'pinch-zoom pan-right',
      'pinch-zoom pan-right pan-down',
      'pinch-zoom pan-right pan-up',
      'pinch-zoom pan-right pan-y',
      'pinch-zoom pan-up',
      'pinch-zoom pan-up pan-left',
      'pinch-zoom pan-up pan-right',
      'pinch-zoom pan-up pan-x',
      'pinch-zoom pan-x',
      'pinch-zoom pan-x pan-down',
      'pinch-zoom pan-x pan-up',
      'pinch-zoom pan-x pan-y',
      'pinch-zoom pan-y',
      'pinch-zoom pan-y pan-left',
      'pinch-zoom pan-y pan-right',
      'pinch-zoom pan-y pan-x',
    ],
  },
  transform: { kind: 'transform' },
  transformBox: {
    kind: 'enum',
    values: ['border-box', 'content-box', 'fill-box', 'stroke-box', 'view-box'],
  },
  transformOrigin: { kind: 'compound', property: 'transformOrigin' },
  transformStyle: { kind: 'enum', values: ['flat', 'preserve-3d'] },
  transition: { kind: 'compound', property: 'transition' },
  transitionBehavior: {
    kind: 'enum',
    list: true,
    values: ['allow-discrete', 'normal'],
  },
  transitionDelay: { kind: 'time', list: true, negative: true },
  transitionDuration: { kind: 'time', list: true, negative: false },
  transitionProperty: {
    keywords: ['all', 'none'],
    kind: 'identifier',
    separator: 'comma',
    standalone: ['none'],
  },
  transitionTimingFunction: {
    easing: true,
    kind: 'enum',
    list: true,
    values: [
      'ease',
      'ease-in',
      'ease-in-out',
      'ease-out',
      'linear',
      'step-end',
      'step-start',
    ],
  },
  translate: { kind: 'translate' },
  triggerScope: {
    dashed: true,
    keywords: ['all', 'none'],
    kind: 'identifier',
    separator: 'comma',
    standalone: ['all', 'none'],
  },
  unicodeBidi: {
    kind: 'enum',
    values: [
      'bidi-override',
      'embed',
      'isolate',
      'isolate-override',
      'normal',
      'plaintext',
    ],
  },
  userModify: {
    kind: 'enum',
    values: ['read-only', 'read-write', 'read-write-plaintext-only'],
  },
  userSelect: {
    kind: 'enum',
    values: ['all', 'auto', 'none', 'text'],
  },
  vectorEffect: {
    kind: 'enum',
    values: [
      'fixed-position',
      'non-rotation',
      'non-scaling-size',
      'non-scaling-stroke',
      'none',
    ],
  },
  verticalAlign: {
    ...length,
    keywords: [
      'baseline',
      'bottom',
      'middle',
      'sub',
      'super',
      'text-bottom',
      'text-top',
      'top',
    ],
    negative: true,
  },
  viewTimeline: { kind: 'compound', property: 'viewTimeline' },
  viewTimelineAxis: {
    kind: 'enum',
    list: true,
    values: ['block', 'inline', 'x', 'y'],
  },
  viewTimelineInset: {
    kind: 'tuple',
    atoms: ['length', 'percentage'],
    keywords: ['auto'],
    list: true,
    min: 1,
    max: 2,
    negative: true,
  },
  viewTimelineName: {
    dashed: true,
    keywords: ['none'],
    kind: 'identifier',
    separator: 'comma',
  },
  viewTransitionClass: {
    keywords: ['none'],
    kind: 'identifier',
    separator: 'space',
    standalone: ['none'],
  },
  viewTransitionGroup: {
    kind: 'identifier',
    keywords: ['normal', 'contain', 'nearest'],
  },
  viewTransitionName: {
    keywords: ['match-element', 'none'],
    kind: 'identifier',
    excluded: ['auto'],
  },
  viewTransitionScope: { kind: 'enum', values: ['all', 'none'] },
  visibility: { kind: 'enum', values: ['collapse', 'hidden', 'visible'] },
  WebkitAnimationName: {
    keywords: ['none'],
    kind: 'identifier',
    separator: 'comma',
  },
  WebkitAppearance: {
    kind: 'enum',
    values: [
      '-apple-pay-button',
      'button',
      'button-bevel',
      'caret',
      'checkbox',
      'default-button',
      'inner-spin-button',
      'listbox',
      'listitem',
      'media-controls-background',
      'media-controls-fullscreen-background',
      'media-current-time-display',
      'media-enter-fullscreen-button',
      'media-exit-fullscreen-button',
      'media-fullscreen-button',
      'media-mute-button',
      'media-overlay-play-button',
      'media-play-button',
      'media-seek-back-button',
      'media-seek-forward-button',
      'media-slider',
      'media-sliderthumb',
      'media-time-remaining-display',
      'media-toggle-closed-captions-button',
      'media-volume-slider',
      'media-volume-slider-container',
      'media-volume-sliderthumb',
      'menulist',
      'menulist-button',
      'menulist-text',
      'menulist-textfield',
      'meter',
      'none',
      'progress-bar',
      'progress-bar-value',
      'push-button',
      'radio',
      'searchfield',
      'searchfield-cancel-button',
      'searchfield-decoration',
      'searchfield-results-button',
      'searchfield-results-decoration',
      'slider-horizontal',
      'slider-vertical',
      'sliderthumb-horizontal',
      'sliderthumb-vertical',
      'square-button',
      'textarea',
      'textfield',
    ],
  },
  WebkitAppRegion: {
    kind: 'enum',
    values: ['drag', 'no-drag', 'none', 'move'],
  },
  WebkitBackgroundClip: {
    kind: 'enum',
    list: true,
    values: [
      'border-box',
      'content-box',
      'padding-box',
      'text',
      'border',
      'padding',
      'content',
      '-webkit-text',
    ],
  },
  WebkitBackgroundOrigin: {
    kind: 'enum',
    list: true,
    values: [
      'border-box',
      'content-box',
      'padding-box',
      'border',
      'padding',
      'content',
      '-webkit-text',
    ],
  },
  WebkitBorderAfter: { kind: 'line' },
  WebkitBorderAfterColor: color,
  WebkitBorderAfterStyle: border,
  WebkitBorderAfterWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
  WebkitBorderBefore: { kind: 'line' },
  WebkitBorderBeforeColor: color,
  WebkitBorderBeforeStyle: border,
  WebkitBorderBeforeWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
  WebkitBorderEnd: { kind: 'line' },
  WebkitBorderEndColor: color,
  WebkitBorderEndStyle: border,
  WebkitBorderEndWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
  WebkitBorderHorizontalSpacing: stroke,
  WebkitBorderStart: { kind: 'line' },
  WebkitBorderStartColor: color,
  WebkitBorderStartStyle: border,
  WebkitBorderStartWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
  WebkitBorderVerticalSpacing: stroke,
  WebkitBoxPack: {
    kind: 'enum',
    values: ['center', 'end', 'justify', 'start'],
  },
  WebkitBoxReflect: { kind: 'compound', property: 'WebkitBoxReflect' },
  WebkitColumnAxis: {
    kind: 'enum',
    values: ['horizontal', 'vertical', 'auto'],
  },
  WebkitColumnBreakAfter: { kind: 'enum', values: ['auto', 'always', 'avoid'] },
  WebkitColumnBreakBefore: {
    kind: 'enum',
    values: ['auto', 'always', 'avoid'],
  },
  WebkitColumnBreakInside: { kind: 'enum', values: ['auto', 'avoid'] },
  WebkitColumnProgression: { kind: 'enum', values: ['normal', 'reverse'] },
  WebkitCursorVisibility: { kind: 'enum', values: ['auto', 'auto-hide'] },
  WebkitFontFeatureSettings: {
    kind: 'compound',
    property: 'fontFeatureSettings',
  },
  WebkitFontSmoothing: {
    kind: 'enum',
    values: ['antialiased', 'auto', 'none', 'subpixel-antialiased'],
  },
  WebkitHyphenateCharacter: {
    kind: 'compound',
    property: 'hyphenateCharacter',
  },
  WebkitHyphenateLimitAfter: { ...positiveInteger, min: 0, keywords: ['auto'] },
  WebkitHyphenateLimitBefore: {
    ...positiveInteger,
    min: 0,
    keywords: ['auto'],
  },
  WebkitHyphenateLimitLines: {
    ...positiveInteger,
    min: 0,
    keywords: ['no-limit'],
  },
  WebkitLineAlign: { kind: 'enum', values: ['none', 'edges'] },
  WebkitLineBoxContain: {
    kind: 'enum',
    values: [
      'none',
      'block',
      'inline',
      'font',
      'glyphs',
      'replaced',
      'inline-box',
      'initial-letter',
    ],
    groups: [
      ['block'],
      ['inline'],
      ['font'],
      ['glyphs'],
      ['replaced'],
      ['inline-box'],
      ['initial-letter'],
    ],
  },
  WebkitLineClamp: { ...positiveInteger, keywords: ['none'] },
  WebkitLineGrid: { kind: 'identifier', keywords: ['none'] },
  WebkitLineSnap: { kind: 'enum', values: ['none', 'baseline', 'contain'] },
  WebkitLocale: { kind: 'enum', values: ['auto'], quoted: true },
  WebkitMask: { kind: 'compound', property: 'WebkitMask' },
  WebkitMaskAttachment: {
    kind: 'enum',
    list: true,
    values: ['fixed', 'local', 'scroll'],
  },
  WebkitMaskClip: {
    kind: 'enum',
    list: true,
    values: [
      'border',
      'border-box',
      'content',
      'content-box',
      'fill-box',
      'no-clip',
      'padding',
      'padding-box',
      'stroke-box',
      'text',
      'view-box',
    ],
  },
  WebkitMaskComposite: {
    kind: 'enum',
    list: true,
    values: [
      'clear',
      'copy',
      'destination-atop',
      'destination-in',
      'destination-out',
      'destination-over',
      'source-atop',
      'source-in',
      'source-out',
      'source-over',
      'xor',
    ],
  },
  WebkitMaskImage: { kind: 'image', list: true },
  WebkitMaskOrigin: {
    kind: 'enum',
    list: true,
    values: [
      'border',
      'border-box',
      'content',
      'content-box',
      'fill-box',
      'padding',
      'padding-box',
      'stroke-box',
      'view-box',
    ],
  },
  WebkitMaskPosition: { kind: 'compound', property: 'WebkitMaskPosition' },
  WebkitMaskPositionX: {
    ...length,
    negative: true,
    keywords: ['center', 'left', 'right'],
    list: true,
  },
  WebkitMaskPositionY: {
    ...length,
    negative: true,
    keywords: ['bottom', 'center', 'top'],
    list: true,
  },
  WebkitMaskRepeat: { kind: 'compound', property: 'WebkitMaskRepeat' },
  WebkitMaskRepeatX: {
    kind: 'enum',
    values: ['no-repeat', 'repeat', 'round', 'space'],
  },
  WebkitMaskRepeatY: {
    kind: 'enum',
    values: ['no-repeat', 'repeat', 'round', 'space'],
  },
  WebkitMaskSize: { kind: 'compound', property: 'WebkitMaskSize' },
  WebkitMaskSourceType: {
    kind: 'enum',
    values: ['alpha', 'luminance', 'auto'],
    list: true,
  },
  WebkitMaxLogicalHeight: {
    ...maximum,
    functions: ['anchor-size', 'calc-size', 'fit-content'],
  },
  WebkitMaxLogicalWidth: {
    ...maximum,
    functions: ['anchor-size', 'calc-size', 'fit-content'],
  },
  WebkitMinLogicalHeight: {
    ...size,
    functions: ['anchor-size', 'calc-size', 'fit-content'],
  },
  WebkitMinLogicalWidth: {
    ...size,
    functions: ['anchor-size', 'calc-size', 'fit-content'],
  },
  WebkitNbspMode: { kind: 'enum', values: ['normal', 'space'] },
  WebkitOverflowScrolling: { kind: 'enum', values: ['auto', 'touch'] },
  WebkitPerspective: { ...stroke, numeric: true, keywords: ['none'] },
  WebkitPerspectiveOriginX: {
    ...length,
    negative: true,
    keywords: ['left', 'center', 'right'],
  },
  WebkitPerspectiveOriginY: {
    ...length,
    negative: true,
    keywords: ['top', 'center', 'bottom'],
  },
  WebkitRtlOrdering: { kind: 'enum', values: ['logical', 'visual'] },
  WebkitRubyPosition: {
    kind: 'enum',
    values: ['before', 'after', 'inter-character'],
  },
  WebkitScrollSnapType: {
    kind: 'enum',
    values: ['none', 'mandatory', 'proximity'],
  },
  WebkitTapHighlightColor: color,
  WebkitTextCombine: { kind: 'enum', values: ['none', 'horizontal'] },
  WebkitTextDecorationsInEffect: {
    kind: 'enum',
    values: [
      'blink',
      'blink line-through',
      'blink line-through overline',
      'blink line-through overline underline',
      'blink line-through underline',
      'blink line-through underline overline',
      'blink overline',
      'blink overline line-through',
      'blink overline line-through underline',
      'blink overline underline',
      'blink overline underline line-through',
      'blink underline',
      'blink underline line-through',
      'blink underline line-through overline',
      'blink underline overline',
      'blink underline overline line-through',
      'grammar-error',
      'line-through',
      'line-through blink',
      'line-through blink overline',
      'line-through blink overline underline',
      'line-through blink underline',
      'line-through blink underline overline',
      'line-through overline',
      'line-through overline blink',
      'line-through overline blink underline',
      'line-through overline underline',
      'line-through overline underline blink',
      'line-through underline',
      'line-through underline blink',
      'line-through underline blink overline',
      'line-through underline overline',
      'line-through underline overline blink',
      'none',
      'overline',
      'overline blink',
      'overline blink line-through',
      'overline blink line-through underline',
      'overline blink underline',
      'overline blink underline line-through',
      'overline line-through',
      'overline line-through blink',
      'overline line-through blink underline',
      'overline line-through underline',
      'overline line-through underline blink',
      'overline underline',
      'overline underline blink',
      'overline underline blink line-through',
      'overline underline line-through',
      'overline underline line-through blink',
      'spelling-error',
      'underline',
      'underline blink',
      'underline blink line-through',
      'underline blink line-through overline',
      'underline blink overline',
      'underline blink overline line-through',
      'underline line-through',
      'underline line-through blink',
      'underline line-through blink overline',
      'underline line-through overline',
      'underline line-through overline blink',
      'underline overline',
      'underline overline blink',
      'underline overline blink line-through',
      'underline overline line-through',
      'underline overline line-through blink',
    ],
  },
  WebkitTextDecorationSkip: {
    kind: 'compound',
    property: 'textDecorationSkip',
  },
  WebkitTextFillColor: color,
  WebkitTextOrientation: {
    kind: 'enum',
    values: ['mixed', 'sideways', 'upright'],
  },
  WebkitTextSecurity: {
    kind: 'enum',
    values: ['disc', 'circle', 'square', 'none'],
  },
  WebkitTextStroke: { kind: 'compound', property: 'WebkitTextStroke' },
  WebkitTextStrokeColor: color,
  WebkitTextStrokeWidth: stroke,
  WebkitTextZoom: { kind: 'enum', values: ['normal', 'reset'] },
  WebkitTouchCallout: { kind: 'enum', values: ['default', 'none'] },
  WebkitTransformOriginX: {
    ...length,
    negative: true,
    keywords: ['left', 'center', 'right'],
  },
  WebkitTransformOriginY: {
    ...length,
    negative: true,
    keywords: ['top', 'center', 'bottom'],
  },
  WebkitTransformOriginZ: { ...stroke, negative: true },
  WebkitUserDrag: { kind: 'enum', values: ['auto', 'none', 'element'] },
  WebkitUserModify: {
    kind: 'enum',
    values: ['read-only', 'read-write', 'read-write-plaintext-only'],
  },
  WebkitUserSelect: { kind: 'enum', values: ['all', 'auto', 'none', 'text'] },
  WebkitWritingMode: {
    kind: 'enum',
    values: [
      'horizontal-tb',
      'vertical-lr',
      'vertical-rl',
      'sideways-lr',
      'sideways-rl',
      'lr-tb',
      'rl-tb',
      'tb-rl',
      'lr',
      'rl',
      'tb',
      'horizontal-bt',
    ],
  },
  whiteSpace: {
    kind: 'enum',
    values: [
      'break-spaces',
      'break-spaces nowrap',
      'break-spaces wrap',
      'collapse',
      'collapse nowrap',
      'collapse wrap',
      'normal',
      'nowrap',
      'nowrap break-spaces',
      'nowrap collapse',
      'nowrap preserve',
      'nowrap preserve-breaks',
      'nowrap preserve-spaces',
      'pre',
      'pre-line',
      'pre-wrap',
      'preserve',
      'preserve nowrap',
      'preserve wrap',
      'preserve-breaks',
      'preserve-breaks nowrap',
      'preserve-breaks wrap',
      'preserve-spaces',
      'preserve-spaces nowrap',
      'preserve-spaces wrap',
      'wrap',
      'wrap break-spaces',
      'wrap collapse',
      'wrap preserve',
      'wrap preserve-breaks',
      'wrap preserve-spaces',
    ],
  },
  whiteSpaceCollapse: {
    kind: 'enum',
    values: [
      'break-spaces',
      'collapse',
      'preserve',
      'preserve-breaks',
      'preserve-spaces',
    ],
  },
  whiteSpaceTrim: {
    kind: 'enum',
    values: ['none', 'discard-before', 'discard-after', 'discard-inner'],
    groups: [['discard-before'], ['discard-after'], ['discard-inner']],
  },
  widows: positiveInteger,
  width: { ...size, functions: ['anchor-size', 'calc-size', 'fit-content'] },
  willChange: {
    keywords: ['auto', 'contents', 'scroll-position'],
    kind: 'identifier',
    separator: 'comma',
    standalone: ['auto'],
    excluded: ['all', 'none', 'will-change'],
  },
  windowDrag: { kind: 'enum', values: ['none', 'move'] },
  wordBreak: {
    kind: 'enum',
    values: ['auto-phrase', 'break-all', 'break-word', 'keep-all', 'normal'],
  },
  wordSpacing: textSpacing,
  wordWrap: { kind: 'enum', values: ['break-word', 'normal'] },
  wrapInside: { kind: 'enum', values: ['auto', 'avoid'] },
  writingMode: {
    kind: 'enum',
    values: [
      'horizontal-tb',
      'sideways-lr',
      'sideways-rl',
      'vertical-lr',
      'vertical-rl',
    ],
  },
  x: { ...length, negative: true },
  y: { ...length, negative: true },
  zIndex: {
    integer: true,
    keywords: ['auto'],
    kind: 'number',
    max: Number.MAX_SAFE_INTEGER,
    min: Number.MIN_SAFE_INTEGER,
  },
  zoom: { kind: 'compound', property: 'zoom', negative: false },
} as const satisfies Record<string, Rule>

const propertyAliases = {
  colorAdjust: 'printColorAdjust',
  insetArea: 'positionArea',
  KhtmlBoxAlign: 'boxAlign',
  KhtmlBoxDirection: 'boxDirection',
  KhtmlBoxFlex: 'boxFlex',
  KhtmlBoxFlexGroup: 'boxFlexGroup',
  KhtmlBoxLines: 'boxLines',
  KhtmlBoxOrdinalGroup: 'boxOrdinalGroup',
  KhtmlBoxOrient: 'boxOrient',
  KhtmlBoxPack: 'boxPack',
  KhtmlLineBreak: 'lineBreak',
  KhtmlOpacity: 'opacity',
  KhtmlUserModify: 'userModify',
  KhtmlUserSelect: 'userSelect',
  motion: 'offset',
  motionDistance: 'offsetDistance',
  motionPath: 'offsetPath',
  motionRotation: 'offsetRotate',
  MozAnimation: 'animation',
  MozAnimationDelay: 'animationDelay',
  MozAnimationDirection: 'animationDirection',
  MozAnimationDuration: 'animationDuration',
  MozAnimationFillMode: 'animationFillMode',
  MozAnimationIterationCount: 'animationIterationCount',
  MozAnimationPlayState: 'animationPlayState',
  MozAnimationTimingFunction: 'animationTimingFunction',
  MozBackfaceVisibility: 'backfaceVisibility',
  MozBackgroundSize: 'backgroundSize',
  MozBorderEndColor: 'borderInlineEndColor',
  MozBorderEndStyle: 'borderInlineEndStyle',
  MozBorderEndWidth: 'borderInlineEndWidth',
  MozBorderImage: 'borderImage',
  MozBorderRadius: 'borderRadius',
  MozBorderRadiusBottomleft: 'borderBottomLeftRadius',
  MozBorderRadiusBottomright: 'borderBottomRightRadius',
  MozBorderRadiusTopleft: 'borderTopLeftRadius',
  MozBorderRadiusTopright: 'borderTopRightRadius',
  MozBorderStartColor: 'borderInlineStartColor',
  MozBorderStartStyle: 'borderInlineStartStyle',
  MozBoxAlign: 'boxAlign',
  MozBoxDirection: 'boxDirection',
  MozBoxFlex: 'boxFlex',
  MozBoxOrdinalGroup: 'boxOrdinalGroup',
  MozBoxOrient: 'boxOrient',
  MozBoxPack: 'boxPack',
  MozBoxShadow: 'boxShadow',
  MozBoxSizing: 'boxSizing',
  MozColumnCount: 'columnCount',
  MozColumnFill: 'columnFill',
  MozColumnRule: 'columnRule',
  MozColumnRuleColor: 'columnRuleColor',
  MozColumnRuleStyle: 'columnRuleStyle',
  MozColumnRuleWidth: 'columnRuleWidth',
  MozColumns: 'columns',
  MozColumnWidth: 'columnWidth',
  MozFontFeatureSettings: 'fontFeatureSettings',
  MozHyphens: 'hyphens',
  MozMarginEnd: 'marginInlineEnd',
  MozMarginStart: 'marginInlineStart',
  MozOpacity: 'opacity',
  MozOutline: 'outline',
  MozOutlineColor: 'outlineColor',
  MozOutlineStyle: 'outlineStyle',
  MozOutlineWidth: 'outlineWidth',
  MozPaddingEnd: 'paddingInlineEnd',
  MozPaddingStart: 'paddingInlineStart',
  MozPerspective: 'perspective',
  MozPerspectiveOrigin: 'perspectiveOrigin',
  MozTabSize: 'tabSize',
  MozTextAlignLast: 'textAlignLast',
  MozTextDecorationColor: 'textDecorationColor',
  MozTextDecorationLine: 'textDecorationLine',
  MozTextDecorationStyle: 'textDecorationStyle',
  MozTextSizeAdjust: 'textSizeAdjust',
  MozTransform: 'transform',
  MozTransformOrigin: 'transformOrigin',
  MozTransformStyle: 'transformStyle',
  MozTransition: 'transition',
  MozTransitionDelay: 'transitionDelay',
  MozTransitionDuration: 'transitionDuration',
  MozTransitionProperty: 'transitionProperty',
  MozTransitionTimingFunction: 'transitionTimingFunction',
  MozUserSelect: 'userSelect',
  MsFlex: 'flex',
  MsFlexDirection: 'flexDirection',
  MsFlexPositive: 'flexGrow',
  MsHyphens: 'hyphens',
  MsImeMode: 'imeMode',
  MsLineBreak: 'lineBreak',
  MsOrder: 'order',
  MsOverflowX: 'overflowX',
  MsOverflowY: 'overflowY',
  MsTextCombineHorizontal: 'textCombineUpright',
  MsTextOverflow: 'textOverflow',
  MsTouchAction: 'touchAction',
  MsTransform: 'transform',
  MsTransformOrigin: 'transformOrigin',
  MsTransition: 'transition',
  MsTransitionDelay: 'transitionDelay',
  MsTransitionDuration: 'transitionDuration',
  MsTransitionProperty: 'transitionProperty',
  MsTransitionTimingFunction: 'transitionTimingFunction',
  MsWordBreak: 'wordBreak',
  MsWritingMode: 'writingMode',
  OAnimation: 'animation',
  OAnimationDelay: 'animationDelay',
  OAnimationDirection: 'animationDirection',
  OAnimationDuration: 'animationDuration',
  OAnimationFillMode: 'animationFillMode',
  OAnimationIterationCount: 'animationIterationCount',
  OAnimationPlayState: 'animationPlayState',
  OAnimationTimingFunction: 'animationTimingFunction',
  OBackgroundSize: 'backgroundSize',
  OBorderImage: 'borderImage',
  offsetBlock: 'insetBlock',
  offsetBlockEnd: 'insetBlockEnd',
  offsetBlockStart: 'insetBlockStart',
  offsetInline: 'insetInline',
  offsetInlineEnd: 'insetInlineEnd',
  offsetInlineStart: 'insetInlineStart',
  offsetRotation: 'offsetRotate',
  OObjectFit: 'objectFit',
  OObjectPosition: 'objectPosition',
  OTabSize: 'tabSize',
  OTextOverflow: 'textOverflow',
  OTransform: 'transform',
  OTransformOrigin: 'transformOrigin',
  OTransition: 'transition',
  OTransitionDelay: 'transitionDelay',
  OTransitionDuration: 'transitionDuration',
  OTransitionProperty: 'transitionProperty',
  OTransitionTimingFunction: 'transitionTimingFunction',
  positionTryOptions: 'positionTryFallbacks',
  scrollSnapMargin: 'scrollMargin',
  scrollSnapMarginBottom: 'scrollMarginBottom',
  scrollSnapMarginLeft: 'scrollMarginLeft',
  scrollSnapMarginRight: 'scrollMarginRight',
  scrollSnapMarginTop: 'scrollMarginTop',
  WebkitAlignContent: 'alignContent',
  WebkitAlignItems: 'alignItems',
  WebkitAlignSelf: 'alignSelf',
  WebkitAlt: 'alt',
  WebkitAnimation: 'animation',
  WebkitAnimationDelay: 'animationDelay',
  WebkitAnimationDirection: 'animationDirection',
  WebkitAnimationDuration: 'animationDuration',
  WebkitAnimationFillMode: 'animationFillMode',
  WebkitAnimationIterationCount: 'animationIterationCount',
  WebkitAnimationPlayState: 'animationPlayState',
  WebkitAnimationTimingFunction: 'animationTimingFunction',
  WebkitBackdropFilter: 'backdropFilter',
  WebkitBackfaceVisibility: 'backfaceVisibility',
  WebkitBackgroundSize: 'backgroundSize',
  WebkitBorderBottomLeftRadius: 'borderBottomLeftRadius',
  WebkitBorderBottomRightRadius: 'borderBottomRightRadius',
  WebkitBorderImage: 'borderImage',
  WebkitBorderImageSlice: 'borderImageSlice',
  WebkitBorderRadius: 'borderRadius',
  WebkitBorderTopLeftRadius: 'borderTopLeftRadius',
  WebkitBorderTopRightRadius: 'borderTopRightRadius',
  WebkitBoxAlign: 'boxAlign',
  WebkitBoxDecorationBreak: 'boxDecorationBreak',
  WebkitBoxDirection: 'boxDirection',
  WebkitBoxFlex: 'boxFlex',
  WebkitBoxFlexGroup: 'boxFlexGroup',
  WebkitBoxLines: 'boxLines',
  WebkitBoxOrdinalGroup: 'boxOrdinalGroup',
  WebkitBoxOrient: 'boxOrient',
  WebkitBoxShadow: 'boxShadow',
  WebkitBoxSizing: 'boxSizing',
  WebkitClipPath: 'clipPath',
  WebkitColumnCount: 'columnCount',
  WebkitColumnFill: 'columnFill',
  WebkitColumnRule: 'columnRule',
  WebkitColumnRuleColor: 'columnRuleColor',
  WebkitColumnRuleStyle: 'columnRuleStyle',
  WebkitColumnRuleWidth: 'columnRuleWidth',
  WebkitColumns: 'columns',
  WebkitColumnSpan: 'columnSpan',
  WebkitColumnWidth: 'columnWidth',
  WebkitFilter: 'filter',
  WebkitFlex: 'flex',
  WebkitFlexBasis: 'flexBasis',
  WebkitFlexDirection: 'flexDirection',
  WebkitFlexFlow: 'flexFlow',
  WebkitFlexGrow: 'flexGrow',
  WebkitFlexShrink: 'flexShrink',
  WebkitFlexWrap: 'flexWrap',
  WebkitFontKerning: 'fontKerning',
  WebkitFontVariantLigatures: 'fontVariantLigatures',
  WebkitHyphens: 'hyphens',
  WebkitInitialLetter: 'initialLetter',
  WebkitJustifyContent: 'justifyContent',
  WebkitLineBreak: 'lineBreak',
  WebkitLogicalHeight: 'blockSize',
  WebkitLogicalWidth: 'inlineSize',
  WebkitMarginAfter: 'marginBlockEnd',
  WebkitMarginBefore: 'marginBlockStart',
  WebkitMarginEnd: 'marginInlineEnd',
  WebkitMarginStart: 'marginInlineStart',
  WebkitMaskBoxImage: 'maskBorder',
  WebkitMaskBoxImageOutset: 'maskBorderOutset',
  WebkitMaskBoxImageRepeat: 'maskBorderRepeat',
  WebkitMaskBoxImageSlice: 'maskBorderSlice',
  WebkitMaskBoxImageSource: 'maskBorderSource',
  WebkitMaskBoxImageWidth: 'maskBorderWidth',
  WebkitMaxInlineSize: 'maxInlineSize',
  WebkitOrder: 'order',
  WebkitPaddingEnd: 'paddingInlineEnd',
  WebkitPaddingStart: 'paddingInlineStart',
  WebkitPerspectiveOrigin: 'perspectiveOrigin',
  WebkitPrintColorAdjust: 'printColorAdjust',
  WebkitShapeMargin: 'shapeMargin',
  WebkitTextDecorationColor: 'textDecorationColor',
  WebkitTextDecorationLine: 'textDecorationLine',
  WebkitTextDecorationStyle: 'textDecorationStyle',
  WebkitTextEmphasis: 'textEmphasis',
  WebkitTextEmphasisColor: 'textEmphasisColor',
  WebkitTextEmphasisPosition: 'textEmphasisPosition',
  WebkitTextEmphasisStyle: 'textEmphasisStyle',
  WebkitTextSizeAdjust: 'textSizeAdjust',
  WebkitTextUnderlinePosition: 'textUnderlinePosition',
  WebkitTransform: 'transform',
  WebkitTransformOrigin: 'transformOrigin',
  WebkitTransformStyle: 'transformStyle',
  WebkitTransition: 'transition',
  WebkitTransitionDelay: 'transitionDelay',
  WebkitTransitionDuration: 'transitionDuration',
  WebkitTransitionProperty: 'transitionProperty',
  WebkitTransitionTimingFunction: 'transitionTimingFunction',
} as const satisfies Record<string, keyof typeof properties>

/** Supported literal properties, including equivalent legacy spellings. */
export const rules = {
  ...properties,
  ...Object.fromEntries(
    Object.entries(propertyAliases).map(([name, property]) => [
      name,
      properties[property],
    ]),
  ),
} as typeof properties & {
  readonly [property in keyof typeof propertyAliases]: (typeof properties)[(typeof propertyAliases)[property]]
}

/** Canonical conflict domains retain authored order across legacy spellings. */
export const aliases = {
  ...legacyAliases,
  ...propertyAliases,
  MozAnimationName: 'animationName',
  MozBackgroundClip: 'backgroundClip',
  MozBackgroundOrigin: 'backgroundOrigin',
  MozFontLanguageOverride: 'fontLanguageOverride',
  MozOsxFontSmoothing: 'fontSmooth',
  OAnimationName: 'animationName',
  WebkitAnimationName: 'animationName',
  WebkitAppRegion: 'windowDrag',
  WebkitBackgroundClip: 'backgroundClip',
  WebkitBackgroundOrigin: 'backgroundOrigin',
  WebkitBoxPack: 'boxPack',
  WebkitColumnBreakAfter: 'breakAfter',
  WebkitColumnBreakBefore: 'breakBefore',
  WebkitColumnBreakInside: 'breakInside',
  WebkitFontFeatureSettings: 'fontFeatureSettings',
  WebkitFontSmoothing: 'fontSmooth',
  WebkitHyphenateCharacter: 'hyphenateCharacter',
  WebkitLineClamp: 'lineClamp',
  WebkitMaxLogicalHeight: 'maxBlockSize',
  WebkitMaxLogicalWidth: 'maxInlineSize',
  WebkitMinLogicalHeight: 'minBlockSize',
  WebkitMinLogicalWidth: 'minInlineSize',
  WebkitPerspective: 'perspective',
  WebkitRubyPosition: 'rubyPosition',
  WebkitScrollSnapType: 'scrollSnapType',
  WebkitTextCombine: 'textCombineUpright',
  WebkitTextDecorationSkip: 'textDecorationSkip',
  WebkitTextOrientation: 'textOrientation',
  WebkitWritingMode: 'writingMode',
} as const
