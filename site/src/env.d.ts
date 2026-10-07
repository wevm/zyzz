/** Build-time syntax highlighting for the landing-page examples. @module */
declare const __EXAMPLE__: {
  bg: string
  fg: string
  files: readonly {
    name: string
    tokens: readonly (readonly {
      content: string
      color?: string | undefined
    }[])[]
  }[]
}

/** MDX page metadata prepared during the build. Each page chunk carries its own highlighted code. */
declare const __DOCS__: {
  pages: Record<
    string,
    {
      title: string
      description: string
      /** Section `##` and `###` headings in document order, with their anchor IDs. Step headings are excluded. */
      headings: readonly { depth: 2 | 3; id: string; title: string }[]
    }
  >
}

/** Markdown twins prepared during the build, keyed by documentation path. Only server modules read them. */
declare const __MARKDOWN__: Record<string, string>

/** Serialized MiniSearch index of documentation pages and sections, built from the MDX sources. */
declare module 'virtual:search-index' {
  const index: string
  export default index
}
