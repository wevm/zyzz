/**
 * Exposes token-free authoring, ordered style definitions, and theme contracts.
 * @module
 */
/** Explicit theme and layer authoring contracts. */
export * as Config from './Config.js'
/** Token-free literal authoring; requires a compile-time source transform. */
export { style } from './styleFunction.js'
/** Ordered composition of applied styling props. */
export { cx } from './cx.js'
/** Inferred component inputs from callable style definitions. */
export type * as Props from './Props.js'
/** Typed literal style definitions and validation diagnostics. */
export * as Style from './Style.js'
/** Typed theme contracts and compatible token overrides. */
export * as Theme from './Theme.js'
/** Typed CSS variable declarations and inline assignments. */
export { variable } from './variable.js'
/** Immutable shared values, conditions, and compatible variable sets. */
export * as Variables from './Variables.js'
/** Single-element finite recipes compiled ahead of time. */
export { variants } from './variants.js'
