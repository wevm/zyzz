/** Defines legal enclosing contexts for stylesheet declaration helpers. @module */
/** Conditional and layer headers accepted around stylesheet declarations. */
export type Group =
  | '@layer'
  | `@${'container' | 'layer' | 'media' | 'supports'}${'\t' | '\n' | '\r' | '\f' | '(' | `/*${string}*/`}${string}`
  | `@container ${string}`
  | `@layer ${string}`
  | `@media ${string}`
  | `@supports ${string}`
/** Identity options for stylesheet declarations. */
export type Options = {
  /** Explicit identity for named declarations without source rewriting. */
  readonly id?: string | undefined
}

/** Complete definitions nested inside enclosing group keys. */
export type Definitions<input> =
  input extends Record<string, unknown>
    ? Exclude<keyof input, Group> extends never
      ? Definitions<input[keyof input]>
      : Omit<input, Group>
    : never
