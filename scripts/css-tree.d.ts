/** Types the CSS Tree patch data consumed by conformance tooling. @module */
declare module 'css-tree/definition-syntax-data-patch' {
  /** Upstream grammar patches, limited to the property data used by tooling. */
  const patch: {
    /** Property grammar and metadata entries keyed by CSS property name. */
    properties: Record<string, unknown>
  }

  export default patch
}
