/**
 * Declares static values for the compiled JSX style prop.
 * @module
 */
import type * as Literal from '../internal/Literal.js'
import type * as StyleValue from '../internal/StyleValue.js'
import type * as Value from '../internal/Value.js'
import type * as Style from '../Style.js'

type Keys<value> = value extends unknown ? keyof value : never

/**
 * Defines static CSS applied through an element's style prop.
 * @param declarations - Token-free literal CSS declarations.
 * @returns An opaque, non-callable style value after compilation.
 * @throws {MissingTransformError} When authoring executes without compilation.
 */
export function style<const declarations extends Record<string, unknown>>(
  declarations: declarations &
    NoInfer<
      Style.LiteralProperties &
        Value.Checked<declarations> &
        Record<Exclude<Keys<declarations>, keyof Literal.Properties>, never>
    >,
): style.ReturnType {
  void declarations
  throw new MissingTransformError()
}

/** Static authoring contracts. */
export declare namespace style {
  /** Failure when source executes without a compiler. */
  type ErrorType = MissingTransformError
  /** Opaque style value accepted structurally by native JSX style types. */
  type ReturnType = {
    /** Compiler metadata, consumed before reaching a DOM element. */
    readonly [StyleValue.metadata]: { readonly className: string }
    /** Structural overlap with CSS style objects; no declaration is emitted. */
    readonly opacity?: never
  }
}

/** Executed authoring source has not been compiled. */
export class MissingTransformError extends Error {
  /** Reports the missing transform without generating runtime CSS. */
  constructor() {
    super(
      'style requires a compile-time transform. Do not execute untransformed authoring source.',
    )
  }
  /** Stable namespaced diagnostic. */
  override name = 'style.MissingTransformError'
}
