/**
 * Declares the token-free authoring boundary consumed by source transforms.
 * @module
 */
import type * as Literal from './internal/Literal.js'

type Keys<value> = value extends unknown ? keyof value : never

/**
 * Declares literal styles for source extraction. Requires a compile-time transform.
 * @param styles - Token-free literal CSS properties.
 * @returns A callable style definition after source rewriting.
 * @throws {MissingTransformError} Whenever an untransformed definition executes.
 */
export function css<const styles extends Record<string, unknown>>(
  styles: styles &
    NoInfer<
      Literal.Properties &
        Record<Exclude<Keys<styles>, keyof Literal.Properties>, never>
    >,
): css.ReturnType {
  void styles
  throw new MissingTransformError()
}

/** Contracts for the literal authoring boundary. */
export declare namespace css {
  /** Failure from executing source without a transform. */
  type ErrorType = MissingTransformError
  /** Styling overrides consumed by a transformed definition. */
  type Options = {
    /** External class names appended to the generated classes. */
    readonly className?: string | undefined
    /** Literal inline styling overrides. */
    readonly style?: Literal.Properties | undefined
  }
  /** Props produced by a transformed web definition. */
  type Props = {
    /** Compiled and supplied class names. */
    readonly className: string
    /** Supplied inline styling overrides when present. */
    readonly style?: Literal.Properties | undefined
  }
  /** Callable definition; source rewriting supplies its implementation. */
  type ReturnType = <const options extends Options = Options>(
    options?: options & Record<Exclude<Keys<options>, keyof Options>, never>,
  ) => Props
}

/** Executed authoring source has not been rewritten. */
export class MissingTransformError extends Error {
  /** Explains the missing transform without generating runtime CSS. */
  constructor() {
    super(
      'css requires a compile-time transform. Source extraction alone does not rewrite calls; do not execute untransformed authoring source.',
    )
  }
  /** Stable namespaced diagnostic name. */
  override name = 'css.MissingTransformError'
}
