/** Composes relationship conditions from css definitions and CSS selector text. @module */
import type * as Relationships from './internal/Relationships.js'

/** Selects the styled element through interpolated css definitions; each definition compound lowers inside `:where()`. */
export function where(
  strings: TemplateStringsArray,
  ...definitions: readonly Relationships.Definition[]
): Relationships.Key {
  void strings
  void definitions
  throw new Error('Relationships require the Zyzz source transform.')
}
