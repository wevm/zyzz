/** Declares a compiler-owned counterStyle stylesheet identity. @module */
import type * as Context from './internal/Context.js'
import type * as Lexical from '../internal/Lexical.js'
import * as Identity from '../internal/Identity.js'
import type * as RuleReference from '../internal/RuleReference.js'

/** Emits static descriptors and returns a domain-specific CSS name. */
export function counterStyle<
  const options extends Omit<counterStyle.Options, 'system'> & {
    readonly system?: string | undefined
  },
>(
  options: options &
    Record<Exclude<keyof options, keyof counterStyle.Options>, never> &
    RuleReference.Checked<options> & {
      readonly system?: Checked<options['system']>
    } & (System<options['system']> extends 'additive'
      ? { readonly additiveSymbols: string }
      : System<options['system']> extends `extends ${string}`
        ? unknown
        : { readonly symbols: string }),
  context: Context.Options = {},
): counterStyle.Reference {
  void options
  void context
  return Identity.contribution(
    'counterStyle',
    context.id,
  ) as counterStyle.Reference
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
      | 'fixed'
      | `fixed ${bigint}`
      | `extends ${string}`
      | undefined
  }
  /** Compiler-owned reference usable in the matching CSS domain. */
  type Reference = RuleReference.Reference<'counterStyle'>
}

type System<value> = value extends string
  ? Trim<Lexical.Fold<Lexical.Normalized<value>>>
  : undefined
type Checked<value> = value extends string
  ? System<value> extends counterStyle.Options['system']
    ? value
    : never
  : undefined
type Space = ' ' | '\t' | '\n' | '\r' | '\f'
type Trim<value extends string> = value extends `${Space}${infer rest}`
  ? Trim<rest>
  : value extends `${infer rest}${Space}`
    ? Trim<rest>
    : value
