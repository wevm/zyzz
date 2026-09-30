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
