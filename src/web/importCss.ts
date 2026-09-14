/** Declares ordered external stylesheet imports. @module */
/** Emits a stylesheet import before namespaces and ordinary rules. */
export function importCss<const options extends importCss.Options>(
  options: options &
    Record<Exclude<keyof options, keyof importCss.Options>, never>,
): void {
  void options
  return
}
/** Import conditions and layer placement. */
export declare namespace importCss {
  /** Static import URL and optional conditions. */
  type Options = {
    /** Named layer, or true for an anonymous layer. */
    readonly layer?: string | true | undefined
    /** Media query list. */
    readonly media?: string | undefined
    /** Supports condition or declaration, without the outer supports(). */
    readonly supports?: string | undefined
    /** Stylesheet URL resolved relative to its source owner. */
    readonly url: string
  }
}
