/**
 * Declares the token-free authoring boundary consumed by source transforms.
 * @module
 */
import type * as Literal from './internal/Literal.js'
import type * as Style from './Style.js'

type Keys<value> = value extends unknown ? keyof value : never

/**
 * Declares literal styles for source extraction. Requires a compile-time transform.
 * @param styles - Token-free literal CSS properties.
 * @returns A callable style definition after source rewriting.
 * @throws {MissingTransformError} Whenever an untransformed definition executes.
 */
export function css<
  const callback extends (values: never) => Style.LiteralProperties,
>(
  styles: callback &
    ((
      values: Parameters<callback>[0],
    ) => NoInfer<Style.Accepted<ReturnType<callback>, {}, true>>) &
    (Parameters<callback> extends [Record<string, string | number>]
      ? unknown
      : never),
): css.Dynamic<Parameters<callback>[0] & Record<never, never>>
export function css<const styles extends Record<string, unknown>>(
  styles: styles & NoInfer<Style.Accepted<styles, {}, true>>,
): css.ReturnType
export function css(styles: unknown): never {
  void styles
  throw new MissingTransformError()
}

/** Contracts for the literal authoring boundary. */
export declare namespace css {
  /** Callable compiled bindings with required scalar inputs and styling overrides. */
  type Dynamic<values> = <const input extends values & Options>(
    input: input &
      Record<Exclude<keyof input, keyof values | keyof Options>, never>,
  ) => Props
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
