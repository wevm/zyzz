/** Declares stylesheet view-transition navigation and type descriptors. @module */
import { MissingTransformError } from '../css.js'
import type * as Context from './internal/Context.js'

/** Emits an eager view-transition rule; browser navigation owns transition execution. */
export function viewTransition<const options extends viewTransition.Options>(
  options: options &
    Record<Exclude<keyof options, keyof viewTransition.Options>, never>,
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
