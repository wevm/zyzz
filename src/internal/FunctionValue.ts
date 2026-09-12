/** Carries native CSS function result domains through static declaration checking. @module */
declare const result: unique symbol
/** A native function expression with a declared CSS value syntax. */
export type Reference<syntax extends string = '*'> =
  `--${string}(${string})` & { readonly [result]: syntax }
/** Detects a function result without expanding ordinary property grammars. */
export type Is<value> = typeof result extends keyof value ? true : false
/** Accepts a result only when its representative value belongs to the declaration domain. */
export type Accepted<value, property> =
  value extends Reference<infer syntax>
    ? syntax extends '*'
      ? value
      : Representative<syntax> extends property
        ? value
        : never
    : never
type Representative<syntax> = syntax extends '<color>'
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
                : never
