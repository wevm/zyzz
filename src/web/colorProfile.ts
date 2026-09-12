/** Declares a compiler-owned colorProfile stylesheet identity. @module */
import { MissingTransformError } from '../css.js'
import type * as RuleReference from '../internal/RuleReference.js'
import type * as Context from './internal/Context.js'

/** Emits static descriptors and returns a domain-specific CSS name. */
export function colorProfile<const options extends colorProfile.Options>(
  options: options &
    Record<Exclude<keyof options, keyof colorProfile.Options>, never> &
    RuleReference.Checked<options>,
  context: Context.Options = {},
): colorProfile.Reference {
  void options
  void context
  throw new MissingTransformError()
}
/** Descriptor and identity contracts. */
export declare namespace colorProfile {
  /** Exact CSS descriptor input; declaration order is preserved. */
  type Options = {
    /** Ordered, comma-separated component names for relative colors. */
    readonly components?: string | undefined
    /** CSS renderingIntent descriptor. */
    readonly renderingIntent?:
      | 'absolute-colorimetric'
      | 'relative-colorimetric'
      | 'perceptual'
      | 'saturation'
      | undefined
    /** CSS src descriptor. */
    readonly src: string
  }
  /** Compiler-owned reference usable in the matching CSS domain. */
  type Reference = RuleReference.Reference<'colorProfile'>
}
