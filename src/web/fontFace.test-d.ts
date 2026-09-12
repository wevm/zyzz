/** Checks fontFace authoring contexts through the public API. @module */
import { describe, test } from 'vite-plus/test'
import { fontFace } from 'zyzz/web'
describe('fontFace', () => {
  test('checks grouping contexts', () => {
    fontFace(
      {
        fontFamily: 'Body',
        src: 'local("Arial")',
        fontFeatureSettings: '"kern"',
        fontVariationSettings: '"wght" 400',
      },
      { within: ['@layer', '@media screen'] },
    )
    fontFace({ fontFamily: 'Body', src: 'url(/font)' }, undefined)
    // @ts-expect-error selectors cannot enclose font declarations
    fontFace({ fontFamily: 'Body', src: 'url(/font)' }, { within: ['.card'] })
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
