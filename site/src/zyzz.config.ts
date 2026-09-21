/** Defines the site's global styles and self-hosted fonts. @module */
import { fontFace, global } from 'zyzz/web'

export { style } from 'zyzz/default'

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
  body: { fontFamily: `${fonts.sans}, sans-serif` },
  'code, pre': { fontFamily: `${fonts.mono}, monospace` },
})
