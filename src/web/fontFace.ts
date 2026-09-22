/** Declares module-level font-face descriptors without loading fonts. @module */
import type * as Context from './internal/Context.js'

/** Compiles literal font-face descriptors into the initial stylesheet. */
export function fontFace<const options extends Record<string, unknown>>(
  options: options & NoInfer<Accepted<options>>,
  context: Context.Options = {},
): void {
  void context
  void options
  return
}

/** Supported font-face descriptor contracts. */
export declare namespace fontFace {
  /** Source and family plus standard scalar font selection descriptors. */
  type Options = {
    /** OpenType feature settings for the face. */
    readonly fontFeatureSettings?: string | undefined
    /** Variable font axis defaults. */
    readonly fontVariationSettings?: string | undefined
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

type Accepted<input> = {
  [key in keyof input as key extends Context.Group ? key : never]: Accepted<
    input[key]
  >
} & (keyof input extends never
  ? Definition<input>
  : Exclude<keyof input, Context.Group> extends never
    ? unknown
    : Definition<Omit<input, Context.Group>>)

type Definition<options> = options extends fontFace.Options
  ? options & Record<Exclude<keyof options, keyof fontFace.Options>, never>
  : never
