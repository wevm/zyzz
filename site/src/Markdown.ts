/** Reads the build-time Markdown twins once for server modules. Client modules must not import it, so browser bundles leave the Markdown out. @module */

// Vite inlines a `define` at every reference, so other modules read the twins through this binding.
/** Markdown twins, keyed by documentation path. */
export const pages = __MARKDOWN__
