/** Defines legal enclosing contexts for stylesheet declaration helpers. @module */
/** Conditional and layer headers accepted around stylesheet declarations. */
export type Group =
  | '@layer'
  | `@${'container' | 'layer' | 'media' | 'supports'}${'\t' | '\n' | '\r' | '\f' | '(' | `/*${string}*/`}${string}`
  | `@container ${string}`
  | `@layer ${string}`
  | `@media ${string}`
  | `@supports ${string}`
/** Ordered enclosing groups, from outermost to innermost. */
export type Options = {
  /** Explicit identity for named declarations without source rewriting. */
  readonly id?: string | undefined
  /** Enclosing groups; omitted means stylesheet scope. */
  readonly within?: readonly Group[] | undefined
}
