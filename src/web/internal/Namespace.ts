/** Defines source-owned namespace bindings without selector parsing. @module */
/** One authored namespace and its compiler-owned output prefix. */
export type Definition = {
  /** Unique emitted namespace prefix. */
  readonly name: string
  /** Authored selector prefix, or omitted for the default namespace. */
  readonly prefix?: string | undefined
  /** Namespace URI; this is an identity, not an asset URL. */
  readonly uri: string
}
