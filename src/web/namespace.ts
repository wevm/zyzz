/** Declares a module-owned CSS namespace. @module */
import { MissingTransformError } from '../css.js'
/** Emits an isolated namespace binding for the module's selectors. */
export function namespace<const options extends namespace.Options>(
  options: options &
    Record<Exclude<keyof options, keyof namespace.Options>, never>,
): void {
  void options
  throw new MissingTransformError()
}
/** CSS namespace authoring options. */
export declare namespace namespace {
  /** Namespace URI and optional authored selector prefix. */
  type Options = {
    /** Selector prefix; omitted creates a default namespace. */
    readonly prefix?: string | undefined
    /** Namespace URI, never an asset to fetch or relocate. */
    readonly uri: string
  }
}
