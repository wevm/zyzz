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
