/** Infers component inputs from callable style definitions. @module */

/**
 * Extracts variant selections and styling overrides, excluding null and undefined.
 * Preserves optional selections, conditions, and dynamic choice payloads.
 */
export type Variants<definition extends (...args: never[]) => unknown> =
  NonNullable<Parameters<definition>[0]>
