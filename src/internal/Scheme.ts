/** Names the stylesheet classes that select a color scheme beside a theme scope. @module */

/** Supported scheme selections. */
export type Name = 'dark' | 'light' | 'light dark'

/**
 * Compiled class per scheme. Carrying `color-scheme` in stylesheet rules lets
 * Lightning CSS initialize its lowered `light-dark()` helpers when a downstream
 * bundler targets browsers without native support; inline styles cannot.
 */
export const classes: Readonly<Record<Name, string>> = Object.freeze({
  dark: 'z_scheme-dark',
  light: 'z_scheme-light',
  'light dark': 'z_scheme-light-dark',
})

/** Selection rules emitted once beside each stylesheet's theme scopes. */
export const css = (Object.keys(classes) as Name[])
  .map((scheme) => `.${classes[scheme]}{color-scheme:${scheme};}`)
  .join('\n')
