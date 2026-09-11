/** Declares stylesheet view-transition navigation and type descriptors. @module */
import { MissingTransformError } from '../css.js'
import type * as Context from './internal/Context.js'

/** Emits an eager view-transition rule; browser navigation owns transition execution. */
export function viewTransition<
  const options extends Omit<viewTransition.Options, 'navigation'> & {
    readonly navigation?: string | undefined
  },
>(
  options: options &
    Record<Exclude<keyof options, keyof viewTransition.Options>, never> & {
      readonly navigation?: Checked<
        options['navigation'],
        Exclude<viewTransition.Options['navigation'], undefined>
      >
    },
  context: Context.Options = {},
): void {
  void options
  void context
  throw new MissingTransformError()
}
/** Standard navigation and transition type descriptors. */
export declare namespace viewTransition {
  /** Static descriptors for cross-document view transitions. */
  type Options = {
    /** Whether matching same-origin navigation enables transitions. */
    readonly navigation?: 'auto' | 'none' | undefined
    /** CSS custom-identifier list or none. */
    readonly types?: string | undefined
  }
}

type Keyword<value extends string> =
  value extends `${' ' | '\t' | '\n' | '\r' | '\f'}${infer rest}`
    ? Keyword<rest>
    : value extends `${infer rest}${' ' | '\t' | '\n' | '\r' | '\f'}`
      ? Keyword<rest>
      : Lowercase<value>

type Checked<value, domain> = value extends string
  ? Keyword<value> extends domain
    ? value
    : never
  : undefined
