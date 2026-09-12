/** Composes relationship conditions from typed refs and CSS selector text. @module */
import type * as Relationships from './internal/Relationships.js'

/** Selects the styled element through interpolated refs; each ref compound lowers inside `:where()`. */
export function where(
  strings: TemplateStringsArray,
  ...refs: readonly Relationships.Interpolation[]
): Relationships.Key {
  void strings
  void refs
  throw new Error('Relationships require the Zyzz source transform.')
}
