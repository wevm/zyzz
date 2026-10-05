/** Exposes the documentation data prepared during the build. @module */

/**
 * Page metadata and highlighted code fences. Bundlers inline a `define`
 * value at every reference, so other modules read the data through this
 * binding to keep one copy in each bundle.
 */
export const docs: typeof __DOCS__ = __DOCS__
