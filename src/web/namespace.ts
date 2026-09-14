/** Declares a module-owned CSS namespace. @module */
/** Emits an isolated namespace binding for the module's selectors. The last declaration for each decoded prefix applies throughout the module. */
export function namespace<const options extends namespace.Options>(
  options: options &
    Record<Exclude<keyof options, keyof namespace.Options>, never>,
): void {
  void options
  return
}
/** CSS namespace authoring options. */
export declare namespace namespace {
  /** Namespace URI and optional authored selector prefix. */
  type Options = {
    /** CSS identifier spelling, including Unicode and escapes. Omitted creates a default namespace. */
    readonly prefix?: string | undefined
    /** Namespace URI, never an asset to fetch or relocate. */
    readonly uri: string
  }
}
