/** Declares a native custom-property registration with a CSS syntax contract. @module */
import type * as Context from './internal/Context.js'
import type * as FunctionSyntax from '../internal/FunctionSyntax.js'

/** Emits an eager registration. Initial values are checked by the compiler. */
export function property<const options extends property.Options>(
  options: options &
    Record<Exclude<keyof options, keyof property.Options>, never> & {
      readonly syntax: FunctionSyntax.Checked<`type(${options['syntax']})`> extends never
        ? never
        : options['syntax']
    } & (options['syntax'] extends '*'
      ? unknown
      : { readonly initialValue: string | number }),
  context: Context.Options = {},
): void {
  void options
  void context
  return
}

/** Native registration descriptors. */
export declare namespace property {
  /** Descriptors and authored identity for one registration. */
  type Options = {
    /** Whether the registered value inherits. */
    readonly inherits: boolean
    /** Computationally independent initial value, optional for universal syntax. */
    readonly initialValue?: string | number | undefined
    /** Authored custom-property name. */
    readonly name: `--${string}`
    /** Syntax components, alternatives, repetition, or the universal star. */
    readonly syntax: string
  }
}
