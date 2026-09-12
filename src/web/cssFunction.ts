/** Declares a native CSS custom function without evaluating its body in JavaScript. @module */
import type * as FunctionSyntax from '../internal/FunctionSyntax.js'
import type * as Literal from '../internal/Literal.js'
import type * as FunctionValue from '../internal/FunctionValue.js'
import type * as Numeric from '../internal/Numeric.js'
import { MissingTransformError } from '../css.js'
/** Emits a CSS function and returns a callable that formats its fixed CSS expression. */
export function cssFunction<const options extends cssFunction.Options>(
  options: options &
    Record<Exclude<keyof options, keyof cssFunction.Options>, never> & {
      readonly body: Checked<options['body']>
      readonly parameters: {
        [index in keyof options['parameters']]: options['parameters'][index] extends {
          syntax: infer syntax extends string
        }
          ? options['parameters'][index] & {
              readonly syntax: FunctionSyntax.Checked<syntax>
            }
          : options['parameters'][index]
      }
    } & {
      readonly returns?: options extends {
        returns: infer syntax extends string
      }
        ? FunctionSyntax.Checked<syntax>
        : undefined
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
  type Syntax = string
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
  > = <const args extends Arguments<parameters>>(
    ...args: args & {
      [index in keyof args]: index extends keyof parameters
        ? parameters[index] extends { syntax: infer syntax extends string }
          ? FunctionSyntax.IntegerOnly<syntax> extends true
            ? args[index] extends number
              ? Numeric.Checked<args[index], true>
              : args[index]
            : args[index]
          : args[index]
        : args[index]
    }
  ) => FunctionValue.Reference<syntax>
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
    syntax: infer syntax extends string
  }
    ? InputSyntax<FunctionSyntax.Unwrap<syntax>>
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

type InputSyntax<syntax extends string> =
  syntax extends `${infer first}|${infer rest}`
    ?
        | InputSyntax<FunctionSyntax.Trim<first>>
        | InputSyntax<FunctionSyntax.Trim<rest>>
    : syntax extends '*'
      ? string | number
      : syntax extends `${string}${'+' | '#'}`
        ? string
        : syntax extends '<number>' | '<integer>'
          ? number
          : syntax extends '<percentage>'
            ? `${number}%`
            : syntax extends '<length>'
              ? Exclude<Literal.Length, `${number}%`>
              : syntax extends '<length-percentage>'
                ? Literal.Length
                : syntax extends '<angle>'
                  ? `${number}${'deg' | 'grad' | 'rad' | 'turn'}`
                  : syntax extends '<time>'
                    ? Literal.Time
                    : syntax extends '<color>'
                      ? Literal.Color
                      : syntax extends '<resolution>'
                        ? `${number}${'dpi' | 'dpcm' | 'dppx' | 'x'}`
                        : syntax extends '<url>'
                          ? `url(${string})`
                          : syntax extends '<string>'
                            ? `"${string}"` | `'${string}'`
                            : syntax extends
                                  | '<image>'
                                  | '<custom-ident>'
                                  | '<transform-function>'
                                  | '<transform-list>'
                              ? string
                              : syntax
