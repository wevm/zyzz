/**
 * Opts into typed Base UI states and component-aware selector suggestions.
 * `style` accepts static component-first declarations for Base UI parts and for
 * components that declare their states with `part`. `defineConfig` binds that
 * overload to ordinary variable sets and shorthands. CSS is emitted ahead of time.
 * Default token strings are opt-in through `defineConfig({ vars: tokens })`,
 * with `tokens` imported from `zyzz/default`.
 * @module
 */
/** Configures variables and component-aware Base UI style authoring. */
export { create as defineConfig } from './Config.js'
/** The configured component-aware `style` helper, for annotations and declaration emit. */
export type { Factory } from './Style.js'
/** Declares the data-attribute states of a component outside the Base UI catalog. */
export { part } from './Part.js'
/** A component type carrying declared data-attribute states. */
export type { Part } from './Part.js'
/** Authors static states and selectors for an imported Base UI or declared component part. */
export { style } from './Style.js'
