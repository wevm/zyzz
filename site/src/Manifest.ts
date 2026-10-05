/** Exposes the documentation manifest collected at build time. @module */

// The `__DOCS__` define inlines its whole value at every reference, so the
// site reads it through these bindings to bundle one copy.
/** Page metadata and highlighted code blocks keyed by their source. */
export const { code, pages } = __DOCS__
