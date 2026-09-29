/** Checks fontFace authoring contexts through the public API. @module */
import { describe, test } from 'vite-plus/test'
import { fontFace } from 'zyzz/web'
describe('fontFace', () => {
  test('checks grouping contexts', () => {
    fontFace({
      '@layer': {
        '@media screen': {
          fontFamily: 'Body',
          src: 'local("Arial")',
          fontFeatureSettings: '"kern"',
          fontVariationSettings: '"wght" 400',
        },
      },
    })
    fontFace({ fontFamily: 'Body', src: 'url(/font)' }, undefined)
    // @ts-expect-error selectors cannot enclose font declarations
    fontFace({ '.card': { fontFamily: 'Body', src: 'url(/font)' } })
  })
})

describe('fontFace', () => {
  test('covers descriptor inventory and context errors', () => {
    fontFace({
      ascentOverride: '90%',
      descentOverride: '10%',
      fontDisplay: 'swap',
      fontFamily: 'Evidence',
      fontFeatureSettings: '"kern"',
      fontStretch: 'condensed',
      fontStyle: 'italic',
      fontVariationSettings: '"wght" 500',
      fontWeight: '400 700',
      lineGapOverride: '0%',
      sizeAdjust: '110%',
      src: 'url(/font.ttf)',
      unicodeRange: 'U+0000-00FF',
    })
    // @ts-expect-error page descriptors do not belong in font-face bodies
    fontFace({ fontFamily: 'Evidence', src: 'url(/font.ttf)', size: 'A4' })
  })
})

describe('fontFace', () => {
  test('accepts nested group keys and rejects legacy contexts', () => {
    fontFace({
      '@layer definitions': {
        '@media screen': { fontFamily: 'Body', src: 'url(/body.woff2)' },
      },
    })
    // @ts-expect-error grouped font definitions still require a source
    fontFace({ '@layer fonts': { fontFamily: 'Body' } })
    // @ts-expect-error selectors cannot enclose a declaration
    fontFace({ '.card': { fontFamily: 'Body', src: 'url(/body.woff2)' } })
    fontFace(
      { fontFamily: 'Body', src: 'url(/body.woff2)' },
      // @ts-expect-error enclosing groups belong in the definition
      { within: ['@layer definitions'] },
    )
  })
})
