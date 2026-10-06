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

/** MDX page content and syntax highlighting prepared during the build. */
declare const __DOCS__: {
  pages: Record<
    string,
    {
      title: string
      description: string
      /** Section `##` and `###` headings in document order, with their anchor IDs. Step headings are excluded. */
      headings: readonly { depth: 2 | 3; id: string; title: string }[]
      markdown: string
    }
  >
  /** Highlighted code fences, keyed by authored source. */
  code: Record<
    string,
    {
      /** Shiki markup for the lines inside `<code>`, including notation and Twoslash annotations. */
      html: string
      /** Displayed source without notation, used for copying. */
      text: string
    }
  >
}

/** Serialized MiniSearch index of documentation pages and sections, built from the MDX sources. */
declare module 'virtual:search-index' {
  const index: string
  export default index
}
