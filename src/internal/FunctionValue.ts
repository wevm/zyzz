/** Carries native CSS function result domains through static declaration checking. @module */
import type * as FunctionSyntax from './FunctionSyntax.js'

declare const result: unique symbol
/** A native function expression with a declared CSS value syntax. */
export type Reference<syntax extends string = '*'> =
  `--${string}(${string})` & { readonly [result]: syntax }
/** Detects a function result without expanding ordinary property grammars. */
export type Is<value> = typeof result extends keyof value ? true : false
/** Accepts a result only when its representative value belongs to the declaration domain. */
export type Accepted<value, property> =
  value extends Reference<infer syntax>
    ? FunctionSyntax.Unwrap<syntax> extends '*'
      ? value
      : [Representative<FunctionSyntax.Unwrap<syntax>>] extends [never]
        ? never
        : Representative<FunctionSyntax.Unwrap<syntax>> extends property
          ? value
          : never
    : never
type Representative<syntax> = syntax extends `${infer first}|${infer rest}`
  ?
      | Representative<FunctionSyntax.Trim<first>>
      | Representative<FunctionSyntax.Trim<rest>>
  : syntax extends `${infer base}+`
    ?
        | Representative<base>
        | `${Extract<Representative<base>, string | number>} ${Extract<Representative<base>, string | number>}`
    : syntax extends `${infer base}#`
      ?
          | Representative<base>
          | `${Extract<Representative<base>, string | number>}, ${Extract<Representative<base>, string | number>}`
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
