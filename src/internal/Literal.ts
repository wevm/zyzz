/**
 * Defines and validates the supported primitive CSS property and value domains.
 * @module
 */
import * as Colors from './Color.js'
import * as Component from './Component.js'
import * as Grid from './Grid.js'
import * as Geometry from './Geometry.js'
import * as Identifier from './Identifier.js'
import * as Motion from './Motion.js'
import * as Substitution from './Substitution.js'
import * as MathExpression from './Math.js'

/** Refines inferred dimension strings where TypeScript's number template is broader than CSS. */
export type Checked<value> = value extends
  | `${'0x' | '0X' | '0b' | '0B' | '0o' | '0O'}${string}`
  | `${string}${' ' | '\n' | '\r' | '\t' | '\f'}${string}`
  ? value extends Fraction | Length | Time
    ? never
    : value
  : value

/** Math function shapes; dimensional compatibility is validated during compilation. */
export type Calculation = `${'calc' | 'clamp' | 'max' | 'min'}(${string})`

/** Named, hexadecimal, and absolute functional colors; arguments are checked at compilation. */
export type Color =
  | (typeof namedColors)[number]
  | (typeof systemColors)[number]
  | 'currentColor'
  | 'transparent'
  | `#${string}`
  | `${'color' | 'hsl' | 'hsla' | 'hwb' | 'lab' | 'lch' | 'oklab' | 'oklch' | 'rgb' | 'rgba'}(${string})`

/** Flexible grid track dimensions. */
export type Fraction = `${number}fr`

/** Structured track values; nested argument semantics are checked by the compiler. */
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

/** Finite CSS lengths and percentages; numeric zero needs no unit. */
export type Length = `${number}${(typeof lengthUnits)[number]}` | 0

/** Finite property surface with no arbitrary string index signature. */
export type Properties = {
  readonly [key in keyof typeof rules]?: Value<(typeof rules)[key]>
}
/** Finite seconds and milliseconds; CSS times always require units. */
export type Time = `${number}${'ms' | 's'}`

type Rule = { readonly list?: true } & (
  | { [kind in Geometry.Kind]: { readonly kind: kind } }[Geometry.Kind]
  | ({ readonly kind: 'identifier' } & Identifier.valid.Options)
  | { readonly kind: 'line'; readonly outline?: true }
  | {
      readonly auto: boolean
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
    }
  | {
      readonly easing?: true
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
  | { readonly kind: 'grid-line' }
  | { readonly kind: 'grid-tracks'; readonly explicit: boolean }
  | {
      readonly integer?: boolean
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
type Value<rule extends Rule> =
  | `${string}var(--${string})${string}`
  | Global
  | (rule extends { kind: 'ratio' }
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
                          | (rule extends { percentage: true }
                              ? `${number}%`
                              : never),
                          rule
                        >
                      : rule extends { kind: 'percentage' }
                        ? Calculation | `${number}%` | Keywords<rule>
                        : rule extends {
                              kind: 'enum'
                              values: readonly (infer keyword extends string)[]
                            }
                          ?
                              | Listed<
                                  | keyword
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
                              ? number | 'auto' | `span ${bigint}`
                              : rule extends { kind: 'time' }
                                ? Listed<
                                    Calculation | Time | Keywords<rule>,
                                    rule
                                  >
                                :
                                    | Color
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
const namedColors = [
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
const colorKeywordSet = new Set<string>([...namedColors, ...systemColors])

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
export const aliases = {
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

/** Serializes public camel-case property names, including numeric legacy spellings. */
export function name(property: string): string {
  if (property === 'MsScrollbar3dlightColor')
    return '-ms-scrollbar-3dlight-color'
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

/** Single source of truth for the supported literal properties and domains. */
export const rules = {
  accentColor: { ...color, keywords: ['auto'] },
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
  animationTimeline: {
    dashed: true,
    keywords: ['auto', 'none'],
    kind: 'identifier',
    separator: 'comma',
  },
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
  backfaceVisibility: { kind: 'enum', values: ['hidden', 'visible'] },
  backgroundAttachment: { kind: 'enum', values: ['fixed', 'local', 'scroll'] },
  backgroundBlendMode: blend,
  backgroundClip: {
    kind: 'enum',
    values: ['border-box', 'content-box', 'padding-box', 'text'],
  },
  backgroundColor: color,
  backgroundOrigin: {
    kind: 'enum',
    values: ['border-box', 'content-box', 'padding-box'],
  },
  backgroundPosition: {
    ...length,
    keywords: ['bottom', 'center', 'left', 'right', 'top'],
    negative: true,
  },
  backgroundPositionX: {
    ...length,
    keywords: ['center', 'left', 'right'],
    negative: true,
  },
  backgroundPositionY: {
    ...length,
    keywords: ['bottom', 'center', 'top'],
    negative: true,
  },
  backgroundRepeat: {
    kind: 'enum',
    values: ['no-repeat', 'repeat', 'repeat-x', 'repeat-y', 'round', 'space'],
  },
  backgroundSize: { ...length, auto: true, keywords: ['contain', 'cover'] },
  baselineShift: {
    ...length,
    keywords: ['baseline', 'sub', 'super'],
    negative: true,
  },
  baselineSource: { kind: 'enum', values: ['auto', 'first', 'last'] },
  blockSize: size,
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
  borderImageRepeat: {
    items: 2,
    kind: 'enum',
    values: ['repeat', 'round', 'space', 'stretch'],
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
  borderSpacing: stroke,
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
  bottom: margin,
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
  boxSizing: { kind: 'enum', values: ['border-box', 'content-box'] },
  breakAfter: fragmentation,
  breakBefore: fragmentation,
  breakInside: {
    kind: 'enum',
    values: ['auto', 'avoid', 'avoid-column', 'avoid-page'],
  },
  captionSide: { kind: 'enum', values: ['bottom', 'top'] },
  caretAnimation: { kind: 'enum', values: ['auto', 'manual'] },
  caretColor: { ...color, keywords: ['auto'] },
  caretShape: { kind: 'enum', values: ['auto', 'bar', 'block', 'underscore'] },
  clear: {
    kind: 'enum',
    values: ['both', 'inline-end', 'inline-start', 'left', 'none', 'right'],
  },
  clipRule: { kind: 'enum', values: ['evenodd', 'nonzero'] },
  color,
  colorInterpolationFilters: {
    kind: 'enum',
    values: ['auto', 'linearRGB', 'sRGB'],
  },
  colorScheme: {
    kind: 'enum',
    values: [
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
  columnRuleColor: color,
  columnRuleStyle: border,
  columnRuleWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
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
  contentVisibility: { kind: 'enum', values: ['auto', 'hidden', 'visible'] },
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
  cx: { ...length, negative: true },
  cy: { ...length, negative: true },
  direction: { kind: 'enum', values: ['ltr', 'rtl'] },
  display: {
    kind: 'enum',
    values: [
      'block',
      'contents',
      'flex',
      'flow-root',
      'grid',
      'inline',
      'inline-block',
      'inline-flex',
      'inline-grid',
      'inline-table',
      'list-item',
      'none',
      'table',
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
  },
  emptyCells: { kind: 'enum', values: ['hide', 'show'] },
  fieldSizing: { kind: 'enum', values: ['content', 'fixed'] },
  fill: { ...color, keywords: ['context-fill', 'context-stroke', 'none'] },
  fillOpacity: alpha,
  fillRule: { kind: 'enum', values: ['evenodd', 'nonzero'] },
  flexBasis: { ...size, keywords: ['content', ...intrinsic] },
  flexDirection: {
    kind: 'enum',
    values: ['column', 'column-reverse', 'row', 'row-reverse'],
  },
  flexFlow: {
    groups: [
      ['column', 'column-reverse', 'row', 'row-reverse'],
      ['nowrap', 'wrap', 'wrap-reverse'],
    ],
    kind: 'enum',
    values: [
      'column',
      'column-reverse',
      'nowrap',
      'row',
      'row-reverse',
      'wrap',
      'wrap-reverse',
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
  flexWrap: { kind: 'enum', values: ['nowrap', 'wrap', 'wrap-reverse'] },
  float: {
    kind: 'enum',
    values: ['inline-end', 'inline-start', 'left', 'none', 'right'],
  },
  floodColor: color,
  floodOpacity: alpha,
  fontKerning: { kind: 'enum', values: ['auto', 'none', 'normal'] },
  fontOpticalSizing: { kind: 'enum', values: ['auto', 'none'] },
  fontPalette: {
    dashed: true,
    keywords: ['dark', 'light', 'normal'],
    kind: 'identifier',
  },
  fontSize: length,
  fontStretch: fontWidth,
  fontStyle: { kind: 'enum', values: ['italic', 'normal', 'oblique'] },
  fontSynthesis: {
    groups: [['position'], ['small-caps'], ['style'], ['weight']],
    kind: 'enum',
    values: ['none', 'position', 'small-caps', 'style', 'weight'],
  },
  fontSynthesisPosition: { kind: 'enum', values: ['auto', 'none'] },
  fontSynthesisSmallCaps: { kind: 'enum', values: ['auto', 'none'] },
  fontSynthesisStyle: { kind: 'enum', values: ['auto', 'none'] },
  fontSynthesisWeight: { kind: 'enum', values: ['auto', 'none'] },
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
  fontWeight: { kind: 'number', max: 1000, min: 1 },
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
  gap: { ...length, items: 2 },
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
  gridColumnEnd: { kind: 'grid-line' },
  gridColumnStart: { kind: 'grid-line' },
  gridRowEnd: { kind: 'grid-line' },
  gridRowStart: { kind: 'grid-line' },
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
  height: size,
  hyphens: { kind: 'enum', values: ['auto', 'manual', 'none'] },
  imageRendering: {
    kind: 'enum',
    values: ['auto', 'crisp-edges', 'pixelated', 'smooth'],
  },
  imeMode: {
    kind: 'enum',
    values: ['active', 'auto', 'disabled', 'inactive', 'normal'],
  },
  initialLetterAlign: {
    kind: 'enum',
    values: ['alphabetic', 'auto', 'hanging', 'ideographic'],
  },
  inlineSize: size,
  inset: { ...margin, items: 4 },
  insetBlock: { ...margin, items: 2 },
  insetBlockEnd: margin,
  insetBlockStart: margin,
  insetInline: { ...margin, items: 2 },
  insetInlineEnd: margin,
  insetInlineStart: margin,
  interactivity: { kind: 'enum', values: ['auto', 'inert'] },
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
      'normal',
      'space-around',
      'space-between',
      'space-evenly',
      'start',
    ],
  },
  left: margin,
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
  lineHeight: { kind: 'number', max: Infinity, min: 0 },
  lineHeightStep: { ...length, percentage: false },
  listStylePosition: { kind: 'enum', values: ['inside', 'outside'] },
  listStyleType: {
    kind: 'enum',
    values: [
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
  maskBorderMode: { kind: 'enum', values: ['alpha', 'luminance'] },
  maskBorderRepeat: {
    items: 2,
    kind: 'enum',
    values: ['repeat', 'round', 'space', 'stretch'],
  },
  maskClip: {
    kind: 'enum',
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
    values: ['add', 'exclude', 'intersect', 'subtract'],
  },
  maskMode: { kind: 'enum', values: ['alpha', 'luminance', 'match-source'] },
  maskOrigin: {
    kind: 'enum',
    values: [
      'border-box',
      'content-box',
      'fill-box',
      'padding-box',
      'stroke-box',
      'view-box',
    ],
  },
  maskPosition: {
    ...length,
    keywords: ['bottom', 'center', 'left', 'right', 'top'],
    negative: true,
  },
  maskRepeat: {
    kind: 'enum',
    values: ['no-repeat', 'repeat', 'repeat-x', 'repeat-y', 'round', 'space'],
  },
  maskSize: { ...length, auto: true, keywords: ['contain', 'cover'] },
  maskType: { kind: 'enum', values: ['alpha', 'luminance'] },
  masonryAutoFlow: {
    groups: [
      ['next', 'pack'],
      ['definite-first', 'ordered'],
    ],
    kind: 'enum',
    values: ['definite-first', 'next', 'ordered', 'pack'],
  },
  mathShift: { kind: 'enum', values: ['compact', 'normal'] },
  mathStyle: { kind: 'enum', values: ['compact', 'normal'] },
  maxBlockSize: maximum,
  maxHeight: maximum,
  maxInlineSize: maximum,
  maxLines: {
    integer: true,
    keywords: ['none'],
    kind: 'number',
    max: Number.MAX_SAFE_INTEGER,
    min: 1,
  },
  maxWidth: maximum,
  minBlockSize: size,
  minHeight: size,
  minInlineSize: size,
  minWidth: size,
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
  MozFloatEdge: {
    kind: 'enum',
    values: ['border-box', 'content-box', 'margin-box', 'padding-box'],
  },
  MozOrient: {
    kind: 'enum',
    values: ['block', 'horizontal', 'inline', 'vertical'],
  },
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
  MsContentZoomLimitMax: { kind: 'percentage', min: 0, max: Infinity },
  MsContentZoomLimitMin: { kind: 'percentage', min: 0, max: Infinity },
  MsContentZoomSnapType: {
    kind: 'enum',
    values: ['mandatory', 'none', 'proximity'],
  },
  MsHighContrastAdjust: { kind: 'enum', values: ['auto', 'none'] },
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
  MsScrollLimitXMax: { ...stroke, auto: true },
  MsScrollLimitXMin: stroke,
  MsScrollLimitYMax: { ...stroke, auto: true },
  MsScrollLimitYMin: stroke,
  MsScrollRails: { kind: 'enum', values: ['none', 'railed'] },
  MsScrollSnapType: {
    kind: 'enum',
    values: ['mandatory', 'none', 'proximity'],
  },
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
  objectFit: {
    kind: 'enum',
    values: ['contain', 'cover', 'fill', 'none', 'scale-down'],
  },
  objectPosition: {
    ...length,
    keywords: ['bottom', 'center', 'left', 'right', 'top'],
    negative: true,
  },
  offsetDistance: { ...length, negative: true },
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
  outlineWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
  overflow,
  overflowAnchor: { kind: 'enum', values: ['auto', 'none'] },
  overflowBlock: {
    kind: 'enum',
    values: ['auto', 'clip', 'hidden', 'scroll', 'visible'],
  },
  overflowClipBox: { kind: 'enum', values: ['content-box', 'padding-box'] },
  overflowInline: {
    kind: 'enum',
    values: ['auto', 'clip', 'hidden', 'scroll', 'visible'],
  },
  overflowWrap: { kind: 'enum', values: ['anywhere', 'break-word', 'normal'] },
  overflowX: overflow,
  overflowY: overflow,
  overlay: { kind: 'enum', values: ['auto', 'none'] },
  overscrollBehavior: overscroll,
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
  paintOrder: { kind: 'enum', values: ['fill', 'markers', 'normal', 'stroke'] },
  perspective: { ...length, keywords: ['none'], percentage: false },
  perspectiveOrigin: {
    ...length,
    keywords: ['bottom', 'center', 'left', 'right', 'top'],
    negative: true,
  },
  pointerEvents: { kind: 'enum', values: ['auto', 'none'] },
  position: {
    kind: 'enum',
    values: ['absolute', 'fixed', 'relative', 'static', 'sticky'],
  },
  positionAnchor: {
    dashed: true,
    keywords: ['auto', 'match-parent', 'none', 'normal'],
    kind: 'identifier',
  },
  positionVisibility: {
    groups: [['anchors-valid'], ['anchors-visible'], ['no-overflow']],
    kind: 'enum',
    values: ['always', 'anchors-valid', 'anchors-visible', 'no-overflow'],
  },
  printColorAdjust: { kind: 'enum', values: ['economy', 'exact'] },
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
  right: margin,
  rotate: { kind: 'rotate' },
  rowGap: length,
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
  rx: { ...length, auto: true },
  ry: { ...length, auto: true },
  scale: { kind: 'scale' },
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
  shapeImageThreshold: { kind: 'number', min: 0, max: 1 },
  shapeMargin: length,
  shapeRendering: {
    kind: 'enum',
    values: ['auto', 'crispEdges', 'geometricPrecision', 'optimizeSpeed'],
  },
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
  stroke: { ...color, keywords: ['context-fill', 'context-stroke', 'none'] },
  strokeColor: color,
  strokeDashoffset: { ...length, negative: true },
  strokeLinecap: { kind: 'enum', values: ['butt', 'round', 'square'] },
  strokeLinejoin: {
    kind: 'enum',
    values: ['arcs', 'bevel', 'miter', 'miter-clip', 'round'],
  },
  strokeMiterlimit: { kind: 'number', max: Infinity, min: 1 },
  strokeOpacity: alpha,
  strokeWidth: length,
  tableLayout: { kind: 'enum', values: ['auto', 'fixed'] },
  tabSize: {
    integer: true,
    kind: 'number',
    max: Number.MAX_SAFE_INTEGER,
    min: 0,
  },
  textAlign: {
    kind: 'enum',
    values: ['center', 'end', 'justify', 'left', 'right', 'start'],
  },
  textAlignLast: {
    kind: 'enum',
    values: ['auto', 'center', 'end', 'justify', 'left', 'right', 'start'],
  },
  textAnchor: { kind: 'enum', values: ['end', 'middle', 'start'] },
  textBoxTrim: {
    kind: 'enum',
    values: ['none', 'trim-both', 'trim-end', 'trim-start'],
  },
  textCombineUpright: { kind: 'enum', values: ['all', 'none'] },
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
  textIndent: { ...length, negative: true },
  textJustify: {
    kind: 'enum',
    values: ['auto', 'inter-character', 'inter-word', 'none'],
  },
  textOrientation: { kind: 'enum', values: ['mixed', 'sideways', 'upright'] },
  textOverflow: { kind: 'enum', values: ['clip', 'ellipsis'] },
  textRendering: {
    kind: 'enum',
    values: [
      'auto',
      'geometricPrecision',
      'optimizeLegibility',
      'optimizeSpeed',
    ],
  },
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
    values: ['capitalize', 'lowercase', 'none', 'uppercase'],
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
  top: margin,
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
  transformOrigin: {
    ...length,
    keywords: ['bottom', 'center', 'left', 'right', 'top'],
    negative: true,
  },
  transformStyle: { kind: 'enum', values: ['flat', 'preserve-3d'] },
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
  userSelect: { kind: 'enum', values: ['all', 'auto', 'none', 'text'] },
  vectorEffect: { kind: 'enum', values: ['none', 'non-scaling-stroke'] },
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
  viewTimelineAxis: {
    kind: 'enum',
    list: true,
    values: ['block', 'inline', 'x', 'y'],
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
  viewTransitionName: {
    keywords: ['match-element', 'none'],
    kind: 'identifier',
    excluded: ['auto'],
  },
  viewTransitionScope: { kind: 'enum', values: ['all', 'none'] },
  visibility: { kind: 'enum', values: ['collapse', 'hidden', 'visible'] },
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
  WebkitBorderStart: { kind: 'line' },
  WebkitBorderStartColor: color,
  WebkitBorderStartStyle: border,
  WebkitBorderStartWidth: { ...stroke, keywords: ['medium', 'thick', 'thin'] },
  WebkitLineClamp: { ...positiveInteger, keywords: ['none'] },
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
  WebkitMaskRepeatX: {
    kind: 'enum',
    values: ['no-repeat', 'repeat', 'round', 'space'],
  },
  WebkitMaskRepeatY: {
    kind: 'enum',
    values: ['no-repeat', 'repeat', 'round', 'space'],
  },
  WebkitOverflowScrolling: { kind: 'enum', values: ['auto', 'touch'] },
  WebkitTapHighlightColor: color,
  WebkitTextFillColor: color,
  WebkitTextStrokeColor: color,
  WebkitTextStrokeWidth: stroke,
  WebkitTouchCallout: { kind: 'enum', values: ['default', 'none'] },
  WebkitUserModify: {
    kind: 'enum',
    values: ['read-only', 'read-write', 'read-write-plaintext-only'],
  },
  WebkitUserSelect: { kind: 'enum', values: ['all', 'auto', 'none', 'text'] },
  whiteSpace: {
    kind: 'enum',
    values: ['break-spaces', 'normal', 'nowrap', 'pre', 'pre-line', 'pre-wrap'],
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
  widows: positiveInteger,
  width: size,
  willChange: {
    keywords: ['auto', 'contents', 'scroll-position'],
    kind: 'identifier',
    separator: 'comma',
    standalone: ['auto'],
    excluded: ['all', 'none', 'will-change'],
  },
  wordBreak: { kind: 'enum', values: ['break-all', 'keep-all', 'normal'] },
  wordSpacing: textSpacing,
  wordWrap: { kind: 'enum', values: ['break-word', 'normal'] },
  writingMode: {
    kind: 'enum',
    values: ['horizontal-tb', 'vertical-lr', 'vertical-rl'],
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
  zoom: {
    kind: 'number',
    percentage: true,
    keywords: ['normal', 'reset'],
    max: Infinity,
    min: 0,
  },
} as const satisfies Record<string, Rule>

/** Returns a domain explanation when a literal is unsupported. */
export function validate(
  property: keyof typeof rules,
  value: unknown,
): string | undefined {
  const rule: Rule = rules[property]
  if (typeof value === 'string' && globals.has(value)) return undefined
  if (typeof value === 'string' && value.includes('(') && /var\(/i.test(value))
    return Substitution.valid(value)
      ? undefined
      : 'Expected balanced var() expressions with valid custom-property names.'
  if (
    rule.kind === 'ratio' ||
    rule.kind === 'rotate' ||
    rule.kind === 'scale' ||
    rule.kind === 'transform' ||
    rule.kind === 'translate'
  )
    return Geometry.valid(value, { kind: rule.kind, units: lengthUnits })
      ? undefined
      : 'Expected a valid geometric value with compatible dimensions and argument counts.'
  if (rule.kind === 'line') {
    const parts = (() => {
      if (typeof value === 'string')
        return Component.split(value, { separator: 'space' })
      if (value === 0) return ['0']
      return undefined
    })()
    if (!parts || parts.length === 0 || parts.length > 3)
      return 'Expected at most one line width, style, and color in any order.'
    const used = new Set<string>()
    for (const part of parts) {
      if (!part || globals.has(part))
        return 'CSS-wide keywords must stand alone.'
      const width = /^[+-]?(?:0*\.0+|0+)(?:[eE][+-]?\d+)?$/.test(part)
        ? 0
        : part
      const domain = (() => {
        if (
          validate(rule.outline ? 'outlineStyle' : 'borderTopStyle', part) ===
          undefined
        )
          return 'style'
        if (validate('borderTopWidth', width) === undefined) return 'width'
        if (validate('color', part) === undefined) return 'color'
        return undefined
      })()
      if (!domain || used.has(domain))
        return 'Expected at most one line width, style, and color in any order.'
      used.add(domain)
    }
    return undefined
  }
  if (rule.kind === 'identifier')
    return Identifier.valid(value, rule)
      ? undefined
      : 'Expected valid CSS identifiers with the required prefix, reserved-word exclusions, and list boundaries.'
  if (rule.list && typeof value === 'string' && value.includes(',')) {
    const parts = Component.comma(value)
    if (!parts) return 'Expected a nonempty comma-separated list.'
    if (parts.length > 1) {
      for (const part of parts) {
        if (globals.has(part)) return 'CSS-wide keywords must stand alone.'
        const component =
          (rule.kind === 'number' ||
            (rule.kind === 'length' && Number(part) === 0)) &&
          /^[+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(part)
            ? Number(part)
            : part
        const error = validate(property, component)
        if (error) return error
      }
      return undefined
    }
  }
  if (
    typeof value === 'string' &&
    rule.kind === 'length' &&
    rule.axes &&
    value.includes('/')
  ) {
    const axes = Component.split(value, { separator: 'slash' })
    if (!axes) return 'Expected balanced radius axes.'
    if (axes.length > 1)
      return axes.length === 2 &&
        axes.every(
          (axis) =>
            axis &&
            !globals.has(axis) &&
            validate(property, axis === '0' ? 0 : axis) === undefined,
        )
        ? undefined
        : 'Expected one to four nonnegative radii on each side of a single slash.'
  }
  if (
    typeof value === 'string' &&
    (rule.kind === 'color' || rule.kind === 'enum') &&
    rule.items
  ) {
    const parts = Component.split(value, { separator: 'space' })
    if (!parts || parts.length > rule.items)
      return `Expected one to ${rule.items} valid space-separated values.`
    if (parts.length > 1) {
      return parts.every(
        (part) => !globals.has(part) && validate(property, part) === undefined,
      )
        ? undefined
        : `Expected one to ${rule.items} valid space-separated values.`
    }
  }
  if (
    rule.kind === 'enum' &&
    rule.groups &&
    typeof value === 'string' &&
    /[ \t\n\r\f]/.test(value)
  ) {
    const words = value
      .replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '')
      .split(/[ \t\n\r\f]+/)
    const used = new Set<number>()
    for (const word of words) {
      const group = rule.groups.findIndex((group) => group.includes(word))
      if (group < 0 || used.has(group))
        return 'Expected compatible keywords with at most one choice from each group.'
      used.add(group)
    }
    return undefined
  }
  if (
    rule.kind === 'length' &&
    rule.items &&
    typeof value === 'string' &&
    /[ \t\n\r\f]/.test(value)
  ) {
    const parts = Component.split(value, { separator: 'space' })
    if (!parts) return 'Expected a balanced list of length components.'
    if (parts.length > 1) {
      if (
        parts.length <= rule.items &&
        parts.every(
          (part) =>
            !globals.has(part) &&
            !rule.standalone?.includes(part) &&
            validate(
              property,
              /^[+-]?(?:0*\.0+|0+)(?:[eE][+-]?\d+)?$/.test(part) ? 0 : part,
            ) === undefined,
        )
      )
        return undefined
      return `Expected one to ${rule.items} valid space-separated values; CSS-wide keywords must stand alone.`
    }
  }
  if (
    typeof value === 'string' &&
    (rule.kind === 'length' ||
      rule.kind === 'number' ||
      rule.kind === 'percentage' ||
      rule.kind === 'time') &&
    /^(calc|clamp|max|min)\(/i.test(value)
  ) {
    return MathExpression.valid(value, {
      kind: rule.kind,
      percentage: rule.kind === 'length' && rule.percentage !== false,
      units: lengthUnits,
    }) ||
      (rule.kind === 'number' &&
        rule.percentage &&
        MathExpression.valid(value, {
          kind: 'percentage',
          percentage: false,
          units: lengthUnits,
        }))
      ? undefined
      : 'Expected a valid math expression with compatible numeric dimensions.'
  }
  if (rule.kind === 'enum')
    return typeof value === 'string' &&
      (rule.values.includes(value) || (rule.easing && Motion.easing(value)))
      ? undefined
      : `Expected one of: ${rule.values.join(', ')} (or a CSS-wide keyword).`
  if (rule.kind === 'color')
    return typeof value === 'string' &&
      (rule.keywords?.includes(value) ||
        /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value) ||
        colorKeywordSet.has(value) ||
        value === 'currentColor' ||
        value === 'transparent' ||
        Colors.functional(value))
      ? undefined
      : 'Expected a named color, system color, hex color, transparent, or currentColor.'
  if (rule.kind === 'percentage' || rule.kind === 'number')
    return (() => {
      if (typeof value === 'string' && rule.keywords?.includes(value))
        return undefined
      const amount = (() => {
        if (rule.kind === 'number' && typeof value === 'number') return value
        if (rule.kind === 'percentage' || rule.percentage) {
          const match =
            typeof value === 'string'
              ? /^([+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)%$/.exec(value)
              : null
          if (match)
            return Number(match[1]) / (rule.kind === 'number' ? 100 : 1)
        }
        return NaN
      })()
      if (
        Number.isFinite(amount) &&
        (!(rule.kind === 'number' && rule.integer) ||
          Number.isInteger(amount)) &&
        amount >= rule.min &&
        amount <= rule.max
      ) {
        return undefined
      }
      if (
        rule.kind === 'number' &&
        rule.percentage &&
        rule.min === -Infinity &&
        rule.max === Infinity
      )
        return 'Expected a finite number or percentage.'
      const kind = (() => {
        if (rule.kind === 'percentage') return 'percentage'
        return rule.integer ? 'integer' : 'number'
      })()
      return `Expected a finite ${kind} from ${rule.min} to ${rule.max}.`
    })()
  if (rule.kind === 'grid-tracks')
    return Grid.tracks(value, { explicit: rule.explicit, units: lengthUnits })
      ? undefined
      : 'Expected a valid grid track list with nonnegative sizes and valid repetition constraints.'
  if (rule.kind === 'grid-line') {
    if (value === 'auto') return undefined
    if (typeof value === 'number' && Number.isSafeInteger(value) && value !== 0)
      return undefined
    const match =
      typeof value === 'string' ? /^span ([1-9]\d*)$/.exec(value) : null
    const count = match ? Number(match[1]) : NaN
    if (Number.isSafeInteger(count) && count > 0) return undefined
    return 'Expected auto, a nonzero safe integer, or span followed by a positive safe integer.'
  }
  if (rule.kind === 'time') {
    if (typeof value === 'string' && rule.keywords?.includes(value))
      return undefined
    const match =
      typeof value === 'string'
        ? /^([+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)(?:ms|s)$/.exec(value)
        : null
    const amount = match ? Number(match[1]) : NaN
    if (Number.isFinite(amount) && (rule.negative || amount >= 0))
      return undefined
    return `Expected ${rule.negative ? 'a' : 'a nonnegative'} finite time in s or ms.${rule.keywords ? ` Also accepts: ${rule.keywords.join(', ')}.` : ''}`
  }
  if (value === 0 || (rule.auto && value === 'auto')) return undefined
  const match = (() => {
    if (typeof value !== 'string') return null
    const dimension = lengthPattern.exec(value)
    if (dimension || !rule.fraction) return dimension
    return /^([+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)(fr)$/.exec(value)
  })()
  const amount = match ? Number(match[1]) : NaN
  if (Number.isFinite(amount) && (rule.negative || amount >= 0)) {
    // Length-only domains exclude percentages.
    if (rule.percentage !== false || match?.[2] !== '%') return undefined
  }
  if (typeof value === 'string' && rule.keywords?.includes(value))
    return undefined
  return `Expected ${rule.negative ? 'a' : 'a nonnegative'} literal length${rule.auto ? ', auto,' : ''} or numeric zero.${rule.keywords ? ` Also accepts: ${rule.keywords.join(', ')}.` : ''}`
}
