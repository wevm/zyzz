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
    { title: string; description: string; markdown: string }
  >
  code: Record<
    string,
    readonly (readonly { content: string; color: string }[])[]
  >
}
