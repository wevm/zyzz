/** Defines source-owned namespace bindings and their CSS statement encoding. @module */
/** One authored namespace and its compiler-owned output prefix. */
export type Definition = {
  /** Unique emitted namespace prefix. */
  readonly name: string
  /** Authored selector prefix, or omitted for the default namespace. */
  readonly prefix?: string | undefined
  /** Namespace URI; this is an identity, not an asset URL. */
  readonly uri: string
}

/** Encodes a namespace URI as a CSS string, including control characters and quotes. */
export function statement(value: Definition): string {
  // eslint-disable-next-line no-control-regex -- CSS strings require escaping control characters.
  const uri = value.uri.replace(/[\x00-\x1f\x7f"\\]/g, (char) => {
    if (char === '\0') return '\uFFFD'
    if (char === '"' || char === '\\') return `\\${char}`
    return `\\${char.charCodeAt(0).toString(16)} `
  })
  return `@namespace ${value.name} "${uri}";`
}
