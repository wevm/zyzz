/** Defines the site's global styles and self-hosted fonts. @module */
import { defineConfig } from 'zyzz/base-ui/react'
import { tokens } from 'zyzz/default'
import { fontFace, global } from 'zyzz/web'

export const { style, variants, vars } = defineConfig({
  id: 'default',
  vars: tokens,
})

const fonts = { mono: 'Geist Mono', sans: 'Geist' }

fontFace({
  fontDisplay: 'swap',
  fontFamily: fonts.sans,
  fontStyle: 'normal',
  fontWeight: '100 900',
  src: 'url("@fontsource-variable/geist/files/geist-latin-wght-normal.woff2") format("woff2")',
})

fontFace({
  fontDisplay: 'swap',
  fontFamily: fonts.mono,
  fontStyle: 'normal',
  fontWeight: '100 900',
  src: 'url("@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2") format("woff2")',
})

global({
  'html, body': { backgroundColor: vars.color.background.primary },
  body: {
    fontFamily: `${fonts.sans}, sans-serif`,
    MozOsxFontSmoothing: 'grayscale',
    WebkitFontSmoothing: 'antialiased',
  },
  'code, pre': { fontFamily: `${fonts.mono}, monospace` },
})
