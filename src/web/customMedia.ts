/** Declares a compiler-owned custom media query. @module */
import type * as Condition from '../internal/Condition.js'
import { MissingTransformError } from '../css.js'
/** Emits a query definition and returns its opaque grouping key. */
export function customMedia(query: string | boolean): customMedia.Reference {
  void query
  throw new MissingTransformError()
}
/** Custom query key consumed directly as a computed grouping key. */
export declare namespace customMedia {
  /** A generated media condition with a fixed query identity. */
  type Reference = Condition.Query
}
