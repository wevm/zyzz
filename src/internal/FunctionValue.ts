/** Carries native CSS function result domains through static declaration checking. @module */
import type * as FunctionSyntax from './FunctionSyntax.js'
import type * as Literal from './Literal.js'

declare const result: unique symbol
/** A native function expression with a declared CSS value syntax. */
export type Reference<syntax extends string = '*'> =
  `--${string}(${string})` & { readonly [result]: syntax }
/** Detects a function result without expanding ordinary property grammars. */
export type Is<value> = typeof result extends keyof value ? true : false
/** Accepts results only when their value domain and repetition fit the destination. */
export type Accepted<value, property, name> =
  value extends Reference<infer syntax>
    ? Repeated<FunctionSyntax.Unwrap<syntax>, name> extends false
      ? never
      : FunctionSyntax.Unwrap<syntax> extends '*'
        ? value
        : [Representative<FunctionSyntax.Unwrap<syntax>>] extends [never]
          ? never
          : Representative<FunctionSyntax.Unwrap<syntax>> extends property
            ? value
            : never
    : never

type Repetition<syntax> = syntax extends `${infer first}|${infer rest}`
  ?
      | Repetition<FunctionSyntax.Trim<first>>
      | Repetition<FunctionSyntax.Trim<rest>>
  : syntax extends `${string}+`
    ? '+'
    : syntax extends `${string}#`
      ? '#'
      : never

// Finite shorthand domains may have broad textual tails; only explicit list metadata proves repetition.
type Repeated<syntax, name> = [Repetition<syntax>] extends [never]
  ? true
  : name extends `--${string}`
    ? true
    : name extends keyof typeof Literal.rules
      ? [Repetition<syntax>] extends ['#']
        ? (typeof Literal.rules)[name] extends { list: true }
          ? true
          : false
        : false
      : false

type Representative<syntax> = syntax extends `${infer first}|${infer rest}`
  ?
      | Representative<FunctionSyntax.Trim<first>>
      | Representative<FunctionSyntax.Trim<rest>>
  : syntax extends `${infer base}+`
    ?
        | Representative<base>
        | `${Extract<Representative<base>, string | number>} ${string}`
    : syntax extends `${infer base}#`
      ?
          | Representative<base>
          | `${Extract<Representative<base>, string | number>},${string}`
      : syntax extends '<color>'
        ? '#000'
        : syntax extends '<length>'
          ? '1px'
          : syntax extends '<length-percentage>'
            ? '1px' | '1%'
            : syntax extends '<number>'
              ? number
              : syntax extends '<integer>'
                ? 1
                : syntax extends '<percentage>'
                  ? '1%'
                  : syntax extends '<angle>'
                    ? '1deg'
                    : syntax extends '<time>'
                      ? '1s'
                      : syntax extends '<resolution>'
                        ? '1dppx'
                        : syntax extends '<image>'
                          ? 'url(/image.svg)' | 'linear-gradient(red, blue)'
                          : syntax extends '<url>'
                            ? 'url(/image.svg)'
                            : syntax extends '<string>'
                              ? '"text"'
                              : syntax extends '<custom-ident>'
                                ? string
                                : syntax extends
                                      | '<transform-function>'
                                      | '<transform-list>'
                                  ? 'translateX(1px)'
                                  : syntax extends `<${string}>`
                                    ? never
                                    : syntax
