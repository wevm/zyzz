/** Reads the build-time documentation manifest once, so bundles hold one copy of its data. @module */

// Vite inlines a `define` at every reference, so other modules read the manifest through these bindings.
const manifest = __DOCS__

/** Highlighted code fences, keyed by authored source. */
export const code = manifest.code

/** Page metadata and Markdown, keyed by documentation path. */
export const pages = manifest.pages
