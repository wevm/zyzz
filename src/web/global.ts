/** Declares eager module-level global stylesheet effects. @module */
import type * as Condition from '../internal/Condition.js'
import type * as Literal from '../internal/Literal.js'
import type * as Style from '../Style.js'

/** Compiles module-level selector declarations; never registers runtime CSS. */
export function global<const styles extends Record<string, unknown>>(
  styles: styles & NoInfer<global.Body<styles>>,
): void {
  void styles
  return
}

/** Global selector and grouping contracts. */
export declare namespace global {
  /** Selectors contain exact declarations; at-rules contain further selectors. */
  type Body<styles> = {
    [key in keyof styles]: key extends Condition.Query
      ? Body<styles[key]>
      : key extends `@${string}`
        ? key extends Extract<Condition.Raw, `@${string}`>
          ? Body<styles[key]>
          : never
        : Style.Accepted<styles[key]> & WithoutRelationships<styles[key]>
  }
}

/** Global declarations do not accept marker-relative conditions. */
type WithoutRelationships<value> = value extends readonly unknown[]
  ? unknown
  : value extends object
    ? {
        [key in keyof value]: key extends symbol
          ? never
          : key extends keyof Literal.Properties
            ? unknown
            : WithoutRelationships<value[key]>
      }
    : unknown
