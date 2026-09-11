/** Declares module-level font-face descriptors without loading fonts. @module */
import { MissingTransformError } from '../css.js'

/** Compiles literal font-face descriptors into the initial stylesheet. */
export function fontFace<const options extends fontFace.Options>(
  options: options &
    Record<Exclude<keyof options, keyof fontFace.Options>, never>,
): void {
  void options
  throw new MissingTransformError()
}

/** Supported font-face descriptor contracts. */
export declare namespace fontFace {
  /** Source and family plus standard scalar font selection descriptors. */
  type Options = {
    readonly fontFamily: string
    readonly src: string
    readonly fontDisplay?:
      | 'auto'
      | 'block'
      | 'swap'
      | 'fallback'
      | 'optional'
      | undefined
    readonly fontStyle?: string | undefined
    readonly fontWeight?: string | number | undefined
    readonly fontStretch?: string | undefined
    readonly unicodeRange?: string | undefined
    readonly sizeAdjust?: `${number}%` | undefined
    readonly ascentOverride?: 'normal' | `${number}%` | undefined
    readonly descentOverride?: 'normal' | `${number}%` | undefined
    readonly lineGapOverride?: 'normal' | `${number}%` | undefined
  }
}
