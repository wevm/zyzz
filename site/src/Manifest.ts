/** Reads the build-time documentation manifest once, so bundles hold one copy of its data. @module */

// Vite inlines a `define` at every reference, so other modules read the manifest through this binding.
/** Page titles, descriptions, and headings, keyed by documentation path. */
export const pages = __DOCS__.pages
