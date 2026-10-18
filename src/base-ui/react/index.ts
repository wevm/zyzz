/**
 * Opts into typed Base UI states and component-aware selector suggestions.
 * `style` accepts static component-first declarations. `defineConfig` binds that
 * overload to ordinary variable sets and shorthands. CSS is emitted ahead of time.
 * @module
 */
/** Configures variables and component-aware Base UI style authoring. */
export { create as defineConfig } from './Config.js'
/** Authors static states and selectors for an imported Base UI component part. */
export { style } from './Style.js'
