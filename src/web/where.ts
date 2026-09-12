/** Composes relationship conditions from css definitions and CSS selector text. @module */
import type * as Relationships from './internal/Relationships.js'

/**
 * Selects the styled element through interpolated css definitions.
 *
 * Each interpolated definition lowers to its identity class inside a
 * zero-specificity `:where()` wrapper, so authored selector text keeps
 * only the specificity of its own pseudo-classes.
 *
 * @param strings - Selector text around each interpolation; `&` names the styled element.
 * @param definitions - Module-level `css` definitions whose styled elements the selector targets.
 * @returns An opaque condition key accepted by `css` and `Style.define`.
 * @throws When called at runtime without the Zyzz source transform.
 */
export function where(
  strings: TemplateStringsArray,
  ...definitions: readonly Relationships.Definition[]
): Relationships.Key {
  void strings
  void definitions
  throw new Error('Relationships require the Zyzz source transform.')
}
