/**
 * Describes corner curvature keywords and numeric superellipse functions.
 * @module
 */

/** Canonical corner shapes and explicit superellipse curvature. */
export type Value = (typeof keywords)[number] | `superellipse(${string})`

/** Named curvature values from the CSS Borders grammar. */
export const keywords = [
  'bevel',
  'notch',
  'round',
  'scoop',
  'square',
  'squircle',
] as const
