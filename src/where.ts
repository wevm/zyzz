/** Declares selector templates with compiled style references. @module */
import type * as Condition from './internal/Condition.js'
import { MissingTransformError } from './css.js'

/**
 * Declares a scoped CSS selector. Interpolations reference css definitions without calling them.
 * @param strings - Literal selector fragments; & selects the styled element.
 * @param references - Statically resolvable css definitions.
 * @returns An opaque computed style key consumed by the compiler.
 * @throws {MissingTransformError} When an untransformed template executes.
 */
export function where(
  strings: TemplateStringsArray,
  ...references: readonly where.Reference[]
): Condition.Relationship {
  void strings
  void references
  throw new MissingTransformError()
}

/** Selector template contracts. */
export declare namespace where {
  /** Branded callable returned by css, including dynamic and configured definitions. */
  type Reference = { readonly [identity]: true }
}

/** Compile-time brand distinguishing css definitions from arbitrary callables and props. */
declare const identity: unique symbol
