/** Declares a compiler-owned counterStyle stylesheet identity. @module */
import { MissingTransformError } from '../css.js'
import type * as RuleReference from '../internal/RuleReference.js'
import type * as Context from './internal/Context.js'

/** Emits static descriptors and returns a domain-specific CSS name. */
export function counterStyle<const options extends counterStyle.Options>(
  options: options &
    Record<Exclude<keyof options, keyof counterStyle.Options>, never> &
    RuleReference.Checked<options>,
  context: Context.Options = {},
): counterStyle.Reference {
  void options
  void context
  throw new MissingTransformError()
}
/** Descriptor and identity contracts. */
export declare namespace counterStyle {
  /** Exact CSS descriptor input; declaration order is preserved. */
  type Options = {
    /** CSS additiveSymbols descriptor. */
    readonly additiveSymbols?: string | undefined
    /** CSS fallback descriptor. */
    readonly fallback?: string | undefined
    /** CSS negative descriptor. */
    readonly negative?: string | undefined
    /** CSS pad descriptor. */
    readonly pad?: string | undefined
    /** CSS prefix descriptor. */
    readonly prefix?: string | undefined
    /** CSS range descriptor. */
    readonly range?: string | undefined
    /** CSS speakAs descriptor. */
    readonly speakAs?: string | undefined
    /** CSS suffix descriptor. */
    readonly suffix?: string | undefined
    /** CSS symbols descriptor. */
    readonly symbols?: string | undefined
    /** CSS system descriptor. */
    readonly system?:
      | 'cyclic'
      | 'numeric'
      | 'alphabetic'
      | 'symbolic'
      | 'additive'
      | `fixed${string}`
      | `extends ${string}`
      | undefined
  }
  /** Compiler-owned reference usable in the matching CSS domain. */
  type Reference = RuleReference.Reference<'counterStyle'>
}
