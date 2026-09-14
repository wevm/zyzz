/** Declares a compiler-owned custom media query. @module */
import type * as Condition from '../internal/Condition.js'
import * as Identity from '../internal/Identity.js'
/** Emits a query definition and returns its opaque grouping key. */
export function customMedia(
  query: string | boolean,
  options: { readonly id?: string | undefined } = {},
): customMedia.Reference {
  void query
  return `@media (${Identity.contribution('customMedia', options.id)})` as unknown as customMedia.Reference
}
/** Custom query key consumed directly as a computed grouping key. */
export declare namespace customMedia {
  /** A generated media condition with a fixed query identity. */
  type Reference = Condition.Query
}
