/** Declares eager module-level global stylesheet effects. @module */
import { MissingTransformError } from '../css.js'
import type * as Style from '../Style.js'

/** Compiles module-level selector declarations; never registers runtime CSS. */
export function global<const styles extends Record<string, unknown>>(
  styles: styles & NoInfer<global.Body<styles>>,
): void {
  void styles
  throw new MissingTransformError()
}
/** Global selector and grouping contracts. */
export declare namespace global {
  /** Selectors contain exact declarations; at-rules contain further selectors. */
  type Body<styles> = {
    [key in keyof styles]: key extends `@${string}`
      ? Body<styles[key]>
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
          : key extends keyof Style.Properties
            ? unknown
            : WithoutRelationships<value[key]>
      }
    : unknown
