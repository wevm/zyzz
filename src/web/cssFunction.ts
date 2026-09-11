/** Declares a native CSS custom function without evaluating its body in JavaScript. @module */
import type * as Literal from '../internal/Literal.js'
import type * as FunctionValue from '../internal/FunctionValue.js'
import { MissingTransformError } from '../css.js'
/** Emits a CSS function and returns a callable that formats its fixed CSS expression. */
export function cssFunction<const options extends cssFunction.Options>(
  options: options &
    Record<Exclude<keyof options, keyof cssFunction.Options>, never> & {
      readonly body: Checked<options['body']>
    },
): cssFunction.Reference<
  options['parameters'],
  options extends { returns: infer syntax extends cssFunction.Syntax }
    ? syntax
    : '*'
> {
  void options
  throw new MissingTransformError()
}
/** CSS function parameter and result contracts. */
export declare namespace cssFunction {
  /** CSS value syntax accepted by a parameter or returned value. */
  type Syntax =
    | '*'
    | '<color>'
    | '<length>'
    | '<length-percentage>'
    | '<number>'
    | '<percentage>'
    | '<integer>'
    | '<angle>'
    | '<time>'
  /** One ordered parameter with an optional default. */
  type Parameter = {
    /** Parameter custom-property name. */
    readonly name: `--${string}`
    /** CSS parameter syntax; omitted accepts arbitrary CSS tokens. */
    readonly syntax?: Syntax | undefined
    /** Static CSS default, evaluated by the browser. */
    readonly default?: string | number | undefined
  }
  /** Static CSS function definition. */
  type Options = {
    /** Local custom properties, result declarations, and conditional groups. */
    readonly body: Body
    /** Ordered parameter declarations. */
    readonly parameters: readonly Parameter[]
    /** CSS return syntax; omitted accepts arbitrary CSS tokens. */
    readonly returns?: Syntax | undefined
  }
  /** Exact allowed declarations and nested conditions. */
  type Body = {
    /** Function result, or omission for a guaranteed-invalid result. */
    readonly result?: string | number | undefined
    /** Function-local custom-property declarations. */
    readonly [local: `--${string}`]: string | number | undefined
    /** Conditional function result or local assignments. */
    readonly [condition:
      | `@media ${string}`
      | `@supports ${string}`
      | `@container ${string}`]: Body
  }
  /** Callable CSS expression; JavaScript never evaluates the CSS function body. */
  type Reference<
    parameters extends readonly Parameter[] = readonly Parameter[],
    syntax extends Syntax = '*',
  > = (...args: Arguments<parameters>) => FunctionValue.Reference<syntax>
  /** Ordered arguments with optional trailing defaults. */
  type Arguments<parameters extends readonly Parameter[]> =
    number extends parameters['length']
      ? readonly (string | number)[]
      : parameters extends readonly [
            infer first extends Parameter,
            ...infer rest extends readonly Parameter[],
          ]
        ? first extends { default: string | number }
          ? readonly [Input<first>?, ...Arguments<rest>]
          : readonly [Input<first>, ...Arguments<rest>]
        : readonly []
  /** Scalar domain implied by an authored parameter syntax. */
  type Input<parameter extends Parameter> = parameter extends {
    syntax: '<number>' | '<integer>'
  }
    ? number
    : parameter extends { syntax: '<percentage>' }
      ? `${number}%`
      : parameter extends { syntax: '<length>' }
        ? Exclude<Literal.Length, `${number}%`>
        : parameter extends { syntax: '<length-percentage>' }
          ? Literal.Length
          : parameter extends { syntax: '<angle>' }
            ? `${number}${'deg' | 'grad' | 'rad' | 'turn'}`
            : parameter extends { syntax: '<time>' }
              ? Literal.Time
              : parameter extends { syntax: '<color>' }
                ? Literal.Color
                : string | number
}

type Checked<body> = {
  [key in keyof body]: key extends symbol
    ? Checked<body[key]>
    : key extends 'result' | `--${string}`
      ? body[key]
      : key extends
            | `@media ${string}`
            | `@supports ${string}`
            | `@container ${string}`
        ? Checked<body[key]>
        : never
}
