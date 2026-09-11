/** Declares page descriptors and page-margin boxes in authored order. @module */
import { MissingTransformError } from '../css.js'
import type * as Style from '../Style.js'
import type * as Context from './internal/Context.js'

/** Emits an eager page rule, optionally selecting named pages or page pseudo-classes. */
export function page<const descriptors extends Record<string, unknown>>(
  options: {
    readonly descriptors: descriptors & NoInfer<page.Body<descriptors>>
    readonly selector?: string | undefined
  },
  context: Context.Options = {},
): void {
  void options
  void context
  throw new MissingTransformError()
}
/** Page and margin-box authoring contracts. */
export declare namespace page {
  /** Standard page-margin box rule names. */
  type Margin =
    `@${'top-left-corner' | 'top-left' | 'top-center' | 'top-right' | 'top-right-corner' | 'bottom-left-corner' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'bottom-right-corner' | 'left-top' | 'left-middle' | 'left-bottom' | 'right-top' | 'right-middle' | 'right-bottom'}`
  /** CSS page descriptors that are not ordinary element properties. */
  type Descriptors = {
    /** Bleed beyond the page box. */
    readonly bleed?:
      | 'auto'
      | `${number}${'cm' | 'mm' | 'in' | 'pt' | 'px'}`
      | 0
      | undefined
    /** Printer marks outside the page box. */
    readonly marks?:
      | 'none'
      | 'crop'
      | 'cross'
      | 'crop cross'
      | 'cross crop'
      | undefined
    /** Rotation applied to a laid-out page. */
    readonly pageOrientation?:
      | 'upright'
      | 'rotate-left'
      | 'rotate-right'
      | undefined
    /** Page dimensions or a standard named paper size. */
    readonly size?:
      | 'auto'
      | 'portrait'
      | 'landscape'
      | 'A3'
      | 'A4'
      | 'A5'
      | 'B4'
      | 'B5'
      | 'JIS-B4'
      | 'JIS-B5'
      | 'letter'
      | 'legal'
      | 'ledger'
      | `${number}${'mm' | 'cm' | 'in' | 'px' | 'pt'}`
      | `${number}${'mm' | 'cm' | 'in' | 'px' | 'pt'} ${number}${'mm' | 'cm' | 'in' | 'px' | 'pt'}`
      | `${'A3' | 'A4' | 'A5' | 'B4' | 'B5' | 'letter' | 'legal' | 'ledger'} ${'portrait' | 'landscape'}`
      | undefined
  }
  /** Element properties applying to a page context. */
  type Properties = Pick<
    Style.DeclarationProperties,
    Extract<
      keyof Style.DeclarationProperties,
      | `background${string}`
      | `border${string}`
      | `font${string}`
      | `margin${string}`
      | `padding${string}`
      | `outline${string}`
      | 'color'
      | 'counterIncrement'
      | 'counterReset'
      | 'direction'
      | 'height'
      | 'letterSpacing'
      | 'lineHeight'
      | 'maxHeight'
      | 'maxWidth'
      | 'minHeight'
      | 'minWidth'
      | 'quotes'
      | 'textAlign'
      | 'textDecoration'
      | 'textIndent'
      | 'textTransform'
      | 'visibility'
      | 'whiteSpace'
      | 'width'
      | 'wordSpacing'
    >
  >
  /** Additional properties available in page-margin boxes. */
  type MarginProperties = Properties &
    Pick<
      Style.DeclarationProperties,
      'content' | 'overflow' | 'unicodeBidi' | 'verticalAlign' | 'zIndex'
    >
  /** Exact descriptor bodies with isolated page-margin declaration contexts. */
  type Body<body> = Style.Accepted<Omit<body, Margin | keyof Descriptors>> &
    Record<
      Exclude<keyof body, Margin | keyof Descriptors | keyof Properties>,
      never
    > & {
      [key in keyof body as key extends Margin | keyof Descriptors
        ? key
        : never]: key extends Margin
        ? Style.Accepted<body[key]> &
            Record<Exclude<keyof body[key], keyof MarginProperties>, never>
        : key extends keyof Descriptors
          ? Descriptors[key]
          : never
    }
}
