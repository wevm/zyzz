/**
 * Exposes token-free authoring, ordered style definitions, and theme contracts.
 * @module
 */
/** Explicit theme and layer authoring contracts. */
export * as Config from './Config.js'
/** Token-free literal authoring; requires a compile-time source transform. */
export { css } from './css.js'
/** Typed literal style definitions and validation diagnostics. */
export * as Style from './Style.js'
/** Typed theme contracts and compatible token overrides. */
export * as Theme from './Theme.js'
/** Explicit variable contracts and inline assignments. */
export * as Vars from './Vars.js'
/** Scoped selector templates referencing callable style definitions. */
export { where } from './where.js'
