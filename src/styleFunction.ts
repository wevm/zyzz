/**
 * Declares the token-free authoring boundary consumed by source transforms.
 * @module
 */
import * as Authoring from './internal/Authoring.js'
import type * as Binding from './internal/Binding.js'
import type * as Literal from './internal/Literal.js'
import type * as Style from './Style.js'

/** Restricts callback hints to inferred declarations instead of expanding every property grammar. */
type CompletionProperties<styles = Record<string, unknown>> = {
  readonly [property in keyof typeof Literal.rules & keyof styles]?:
    | Literal.Properties[property]
    | (string & {})
    | number
    | object
}

type Keys<value> = value extends unknown ? keyof value : never

type VariableOptions<input> = input extends {
  readonly variables: infer variables
}
  ? {
      readonly variables: {
        readonly [key in keyof variables]: string extends key
          ? variables[key]
          : key extends `--${string}`
            ? variables[key]
            : never
      }
    }
  : unknown

/**
 * Declares literal styles for source extraction. Requires a compile-time transform.
 * @param styles - Token-free literal CSS properties. Omit for an empty definition.
 * @returns A callable style definition after source rewriting.
 * @throws {Error} When a definition needs an explicit identity and none is supplied.
 */
export function style(): style.ReturnType
export function style<
  const values extends Record<string, string | number>,
  const styles extends Record<string, unknown>,
  const callback extends (...args: never[]) => unknown,
>(
  styles: callback &
    ((
      values: values,
    ) => styles &
      NoInfer<Style.Accepted<styles, {}, true> & Binding.Checked<styles>>) &
    CompletionProperties<NoInfer<styles>>,
  // Exclude invalid callbacks by arity so they cannot mask object-property diagnostics.
  ...options: Parameters<callback> extends [Record<string, string | number>]
    ? values extends Binding.Inputs<values>
      ? [options?: style.DefinitionOptions]
      : [invalid: never, unavailable: never]
    : [invalid: never, unavailable: never]
): style.Dynamic<values>
export function style<const styles extends Record<string, unknown>>(
  styles: styles &
    NoInfer<Style.Accepted<styles, {}, true>> &
    CompletionProperties,
  options?: style.DefinitionOptions,
): style.ReturnType
export function style(
  styles?: unknown,
  options: style.DefinitionOptions = {},
): style.ReturnType {
  return Authoring.create(styles, options)
}

/** Compile-time brand identifying callable style definitions. */
declare const identity: unique symbol
type Reference = { readonly [identity]: true }

/** Contracts for the literal authoring boundary. */
export declare namespace style {
  /** Stable identity for selectors and definitions that cannot be content-addressed. */
  type DefinitionOptions = { readonly id?: string | undefined }
  /** Callable compiled bindings with required scalar inputs and styling overrides. */
  type Dynamic<values, output extends Output = 'react'> = Reference &
    (<const input extends values & Options>(
      input: input &
        VariableOptions<input> &
        Record<Exclude<keyof input, keyof values | keyof Options>, never>,
    ) => Props<output>)

  /** Failure from executing source without a transform. */
  type ErrorType = Error

  /** Styling overrides consumed by a transformed definition. */
  type Options = {
    /** External class names appended to the generated classes. */
    readonly className?: string | undefined
    /** Literal inline styling overrides. */
    readonly style?: Literal.Properties | undefined
    /** Inline custom-property assignments, merged before explicit style overrides. */
    readonly variables?:
      | Readonly<Record<`--${string}`, string | number | undefined>>
      | undefined
  }

  /** Props produced by a transformed web definition. */
  type Output = 'html' | 'react'

  /** Renderer-native props selected by configuration. */
  type Props<output extends Output = 'react'> = output extends 'html'
    ? { readonly class: string; readonly style?: string | undefined }
    : {
        /** Compiled and supplied class names. */
        readonly className: string
        /** Supplied inline styling overrides when present. */
        readonly style?:
          | Readonly<Record<string, string | number | undefined>>
          | undefined
      }

  /** Callable definition; source rewriting supplies its implementation. */
  type ReturnType<output extends Output = 'react'> = Reference &
    (<const options extends Options = Options>(
      options?: options &
        VariableOptions<options> &
        Record<Exclude<Keys<options>, keyof Options>, never>,
    ) => Props<output>)
}

/** Executed authoring source has not been rewritten. */
export class MissingTransformError extends Error {
  /** Explains the missing transform without generating runtime CSS. */
  constructor() {
    super(
      'style requires a compile-time transform. Source extraction alone does not rewrite calls; do not execute untransformed authoring source.',
    )
  }
  /** Stable namespaced diagnostic name. */
  override name = 'style.MissingTransformError'
}
