/** Describes compound CSS grammars without shipping a value parser. @module */
import type * as Literal from './Literal.js'

type Angle = `${number}${'deg' | 'grad' | 'rad' | 'turn'}` | Literal.Calculation
type Box =
  | 'border-box'
  | 'content-box'
  | 'fill-box'
  | 'margin-box'
  | 'padding-box'
  | 'stroke-box'
  | 'view-box'
type Chain<value extends string | number> = value | `${value} ${string}`
type List<value extends string | number> = value | `${value},${string}`
type Dimension = Literal.Length | Literal.Calculation
type Filter =
  `${'blur' | 'brightness' | 'contrast' | 'drop-shadow' | 'grayscale' | 'hue-rotate' | 'invert' | 'opacity' | 'saturate' | 'sepia'}(${string})`
type Position = Chain<
  | Dimension
  | 'bottom'
  | 'center'
  | 'left'
  | 'right'
  | 'top'
  | `anchor(${string})`
>
type Quoted = `"${string}"` | `'${string}'`
type Shape =
  `${'circle' | 'ellipse' | 'inset' | 'path' | 'polygon' | 'rect' | 'shape' | 'xywh'}(${string})`
type Area =
  | 'none'
  | Chain<
      | 'bottom'
      | 'center'
      | 'end'
      | 'left'
      | 'right'
      | 'self-end'
      | 'self-start'
      | 'span-all'
      | 'span-end'
      | 'span-start'
      | 'span-self-start'
      | 'span-self-end'
      | 'start'
      | 'top'
      | `${'' | 'span-'}${'block' | 'inline' | 'self-block' | 'self-inline' | 'x' | 'x-self' | 'y' | 'y-self'}-${'end' | 'start'}`
      | `span-${'bottom' | 'left' | 'right' | 'top'}`
    >
type Shadow = Chain<Dimension | Literal.Color | 'inset'>
type Track =
  | Literal.GridTracks
  | `repeat(${string})${string}`
  | `[${string}`
  | 'subgrid'
type Variant =
  | 'normal'
  | 'none'
  | Chain<
      | Exclude<
          Literal.Properties[
            | 'fontVariantCaps'
            | 'fontVariantEastAsian'
            | 'fontVariantLigatures'
            | 'fontVariantNumeric'],
          undefined
        >
      | `${'annotation' | 'character-variant' | 'ornaments' | 'styleset' | 'stylistic' | 'swash'}(${string})`
      | 'historical-forms'
    >

/** Property-specific compound value shapes; function arguments remain CSS text. */
export type Properties = {
  readonly alignTracks: List<
    Exclude<Literal.Properties['alignContent'], undefined>
  >
  readonly animation: string
  readonly animationRange: List<
    Chain<Exclude<Literal.Properties['animationRangeStart'], undefined>>
  >
  readonly animationTrigger: 'none' | List<`--${string}`>
  readonly backdropFilter: 'none' | Chain<Filter | Literal.Url>
  readonly background: List<
    Chain<
      | Literal.Color
      | Literal.Image
      | Position
      | 'none'
      | 'repeat'
      | 'repeat-x'
      | 'repeat-y'
      | 'no-repeat'
      | 'round'
      | 'space'
      | 'fixed'
      | 'local'
      | 'scroll'
      | Box
    >
  >
  readonly borderImage:
    | 'none'
    | Chain<
        | Literal.Image
        | Exclude<Dimension, 0>
        | number
        | 'fill'
        | 'repeat'
        | 'round'
        | 'space'
        | 'stretch'
      >
  readonly borderShape: 'none' | Chain<Shape>
  readonly boxShadow: 'none' | List<Shadow>
  readonly caret: Chain<
    Literal.Color | 'auto' | 'bar' | 'block' | 'manual' | 'underscore'
  >
  readonly clip: 'auto' | `rect(${string})`
  readonly clipPath: 'none' | Literal.Url | Chain<Shape | Box>
  readonly columns:
    | Chain<Exclude<Dimension, 0> | number | 'auto'>
    | `${Exclude<Dimension, 0> | number | 'auto'}/${string}`
  readonly container: string
  readonly content:
    | 'none'
    | 'normal'
    | Chain<
        | Quoted
        | Literal.Image
        | 'open-quote'
        | 'close-quote'
        | 'no-open-quote'
        | 'no-close-quote'
        | 'contents'
        | `${'attr' | 'counter' | 'counters' | 'leader' | 'target-counter' | 'target-counters' | 'target-text'}(${string})`
      >
  readonly counterIncrement: string
  readonly counterReset: string
  readonly counterSet: string
  readonly d: 'none' | `path(${string})`
  readonly filter: 'none' | Chain<Filter | Literal.Url>
  readonly flex: Chain<
    | Exclude<Dimension, 0>
    | number
    | 'auto'
    | 'content'
    | 'fit-content'
    | 'max-content'
    | 'min-content'
    | 'none'
    | `fit-content(${string})`
  >
  readonly font: Chain<
    | Exclude<Dimension, 0>
    | number
    | 'caption'
    | 'icon'
    | 'menu'
    | 'message-box'
    | 'small-caption'
    | 'status-bar'
    | 'italic'
    | 'oblique'
    | 'normal'
    | 'small-caps'
    | 'bold'
    | 'bolder'
    | 'lighter'
    | 'ultra-condensed'
    | 'extra-condensed'
    | 'condensed'
    | 'semi-condensed'
    | 'semi-expanded'
    | 'expanded'
    | 'extra-expanded'
    | 'ultra-expanded'
    | 'xx-small'
    | 'x-small'
    | 'small'
    | 'medium'
    | 'large'
    | 'x-large'
    | 'xx-large'
    | 'xxx-large'
    | 'smaller'
    | 'larger'
  >
  readonly fontFamily: string
  readonly fontFeatureSettings: 'normal' | List<Chain<Quoted>>
  readonly fontLanguageOverride: 'normal' | Quoted
  readonly fontVariant: Variant
  readonly fontVariantAlternates:
    | 'normal'
    | Chain<
        | 'historical-forms'
        | `${'annotation' | 'character-variant' | 'ornaments' | 'styleset' | 'stylistic' | 'swash'}(${string})`
      >
  readonly fontVariationSettings: 'normal' | List<`${Quoted} ${number}`>
  readonly grid:
    | 'none'
    | Chain<Track | Quoted | 'auto-flow' | 'dense'>
    | `${Track}/${string}`
  readonly gridTemplate: 'none' | Chain<Track | Quoted> | `${Track}/${string}`
  readonly gridTemplateAreas: 'none' | Chain<Quoted>
  readonly hyphenateCharacter: 'auto' | Quoted
  readonly imageOrientation: 'from-image' | Angle | Chain<Angle | 'flip'>
  readonly imageResolution: Chain<
    | `${number}${'dpi' | 'dpcm' | 'dppx' | 'x'}`
    | Literal.Calculation
    | 'from-image'
  >
  readonly initialLetter: 'normal' | Chain<number | Literal.Calculation>
  readonly justifyTracks: List<
    Exclude<Literal.Properties['justifyContent'], undefined>
  >
  readonly linkParameters: 'none' | List<`param(${string})`>
  /** List marker identifiers and shorthand components retain CSS text. */
  readonly listStyle: string
  readonly mask: List<
    Chain<
      | Literal.Image
      | Position
      | Box
      | 'none'
      | 'repeat'
      | 'repeat-x'
      | 'repeat-y'
      | 'no-repeat'
      | 'round'
      | 'space'
      | 'add'
      | 'subtract'
      | 'intersect'
      | 'exclude'
      | 'alpha'
      | 'luminance'
      | 'match-source'
      | 'no-clip'
    >
  >
  readonly maskBorder: Chain<
    | Literal.Image
    | Exclude<Dimension, 0>
    | number
    | 'none'
    | 'fill'
    | 'repeat'
    | 'round'
    | 'space'
    | 'stretch'
    | 'alpha'
    | 'luminance'
  >
  readonly mathDepth:
    | number
    | 'auto-add'
    | `add(${string})`
    | Literal.Calculation
  readonly MozContextProperties:
    | 'none'
    | List<'fill' | 'fill-opacity' | 'stroke' | 'stroke-opacity'>
  readonly MozForceBrokenImageIcon: 0 | 1 | '0' | '1'
  readonly MsContentZoomLimit: `${number}% ${number}%`
  readonly MsContentZoomSnap: Chain<
    | 'none'
    | 'mandatory'
    | 'proximity'
    | `snapInterval(${string})`
    | `snapList(${string})`
  >
  readonly MsContentZoomSnapPoints:
    | `snapInterval(${string})`
    | `snapList(${string})`
  readonly MsFilter: Quoted
  readonly MsFlowFrom: string
  readonly MsFlowInto: string
  readonly MsGridColumns: 'none' | Track
  readonly MsGridRows: 'none' | Track
  readonly MsHyphenateLimitLines: number | 'no-limit' | Literal.Calculation
  readonly MsScrollLimit: `${Dimension} ${string}`
  readonly MsScrollSnapPointsX:
    | `snapInterval(${string})`
    | `snapList(${string})`
  readonly MsScrollSnapPointsY:
    | `snapInterval(${string})`
    | `snapList(${string})`
  readonly MsScrollSnapX: `${'none' | 'mandatory' | 'proximity'} ${Properties['MsScrollSnapPointsX']}`
  readonly MsScrollSnapY: `${'none' | 'mandatory' | 'proximity'} ${Properties['MsScrollSnapPointsY']}`
  readonly objectViewBox: 'none' | `${'inset' | 'rect' | 'xywh'}(${string})`
  readonly offset: Chain<
    | Position
    | Literal.Url
    | Shape
    | `ray(${string})`
    | Box
    | 'auto'
    | 'none'
    | 'normal'
    | 'reverse'
  >
  readonly offsetAnchor: 'auto' | Position
  readonly offsetPath:
    | 'none'
    | Chain<Shape | Literal.Url | Box | `ray(${string})`>
  readonly offsetPosition: 'normal' | 'auto' | Position
  readonly offsetRotate:
    | Angle
    | 'auto'
    | 'reverse'
    | `${'auto' | 'reverse'} ${Angle}`
    | `${Angle} ${'auto' | 'reverse'}`
  readonly overflowClipMargin:
    | Dimension
    | 'border-box'
    | 'content-box'
    | 'padding-box'
    | `${'border-box' | 'content-box' | 'padding-box'} ${Dimension}`
    | `${Dimension} ${'border-box' | 'content-box' | 'padding-box'}`
  readonly pathLength:
    | 'none'
    | Exclude<Literal.Length, `${number}%`>
    | Literal.Calculation
  readonly placeContent: Chain<
    Exclude<Literal.Properties['alignContent'], undefined>
  >
  readonly placeItems: Chain<
    Exclude<Literal.Properties['alignItems'], undefined>
  >
  readonly placeSelf: Chain<Exclude<Literal.Properties['alignSelf'], undefined>>
  readonly positionArea: Area
  readonly positionTry: List<
    Chain<
      | Area
      | `--${string}`
      | 'flip-block'
      | 'flip-inline'
      | 'flip-start'
      | 'most-width'
      | 'most-height'
      | 'most-block-size'
      | 'most-inline-size'
      | 'normal'
    >
  >
  readonly positionTryFallbacks: List<
    Chain<Area | `--${string}` | 'flip-block' | 'flip-inline' | 'flip-start'>
  >
  readonly quotes:
    | 'auto'
    | 'none'
    | `${Quoted} ${Quoted}`
    | `${Quoted} ${Quoted} ${string}`
  readonly scrollSnapCoordinate: 'none' | List<Position>
  readonly scrollSnapDestination: Position
  readonly scrollSnapPointsX: 'none' | `repeat(${string})`
  readonly scrollSnapPointsY: 'none' | `repeat(${string})`
  readonly scrollTimeline: string
  readonly shapeOutside: 'none' | Literal.Image | Chain<Shape | Box>
  readonly strokeDasharray: 'none' | List<Chain<Exclude<Dimension, 0> | number>>
  readonly textAutospace:
    | 'auto'
    | 'normal'
    | 'no-autospace'
    | Chain<
        | 'ideograph-alpha'
        | 'ideograph-numeric'
        | 'punctuation'
        | 'insert'
        | 'replace'
      >
  readonly textBox:
    | 'normal'
    | Chain<
        | 'none'
        | 'trim-both'
        | 'trim-end'
        | 'trim-start'
        | 'auto'
        | 'cap'
        | 'ex'
        | 'text'
        | 'ideographic'
        | 'ideographic-ink'
      >
  readonly textDecoration: Chain<
    | Literal.Color
    | Dimension
    | 'auto'
    | 'from-font'
    | Exclude<
        Literal.Properties['textDecorationLine' | 'textDecorationStyle'],
        undefined
      >
  >
  readonly textDecorationSkip:
    | 'none'
    | Chain<
        | 'objects'
        | 'spaces'
        | 'leading-spaces'
        | 'trailing-spaces'
        | 'edges'
        | 'box-decoration'
      >
  readonly textEmphasis: Chain<
    | Literal.Color
    | Quoted
    | 'none'
    | 'filled'
    | 'open'
    | 'dot'
    | 'circle'
    | 'double-circle'
    | 'triangle'
    | 'sesame'
  >
  readonly textFit:
    | 'none'
    | 'grow'
    | 'shrink'
    | `${'none' | 'grow' | 'shrink'} ${'consistent' | 'per-line' | 'per-line-all' | `${number}%`}`
    | `${'none' | 'grow' | 'shrink'} ${'consistent' | 'per-line' | 'per-line-all'} ${number}%`
  readonly textIndent:
    | Dimension
    | `${Dimension} ${string}`
    | `${'hanging' | 'each-line'} ${string}`
  readonly textShadow: 'none' | List<Chain<Dimension | Literal.Color>>
  readonly timelineTrigger: 'none' | List<`--${string}`>
  readonly timelineTriggerActivationRange: List<
    Chain<
      Exclude<
        Literal.Properties['timelineTriggerActivationRangeStart'],
        undefined
      >
    >
  >
  readonly timelineTriggerActiveRange: List<
    Chain<
      Exclude<Literal.Properties['timelineTriggerActiveRangeStart'], undefined>
    >
  >
  readonly transition: string
  readonly viewTimeline: string
  readonly WebkitBoxReflect: Chain<
    Dimension | Literal.Image | 'above' | 'below' | 'left' | 'right'
  >
  readonly WebkitMask:
    | Properties['mask']
    | Chain<'border' | 'content' | 'padding' | 'text'>
  readonly WebkitMaskPosition: List<Position>
  readonly WebkitMaskRepeat: List<
    Exclude<Literal.Properties['maskRepeat'], undefined>
  >
  readonly WebkitMaskSize: List<Chain<Dimension | 'auto' | 'contain' | 'cover'>>
  readonly WebkitTextStroke: Chain<
    Dimension | Literal.Color | 'thin' | 'medium' | 'thick'
  >
}
