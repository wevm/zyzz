/** Checks legal grouping and descriptor contexts through public authoring imports. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { css } from 'zyzz'
import { fontFace, global, keyframes } from 'zyzz/web'

describe('at-rule authoring', () => {
  test('accepts grouped faces, scope, scroll-state queries and named ranges', () => {
    fontFace(
      {
        fontFamily: 'Body',
        src: 'local("Arial")',
        fontFeatureSettings: '"kern"',
        fontVariationSettings: '"wght" 400',
      },
      { within: ['@layer fonts', '@media screen'] },
    )
    expectTypeOf(
      keyframes({ 'entry 0%': { opacity: 0 }, 'exit 100%': { opacity: 1 } }),
    ).toEqualTypeOf<string>()
    css({
      '@scope (.card) to (.stop)': {
        '@container scroll-state(stuck: top)': { color: 'red' },
      },
    })
    global({ '@scope': { body: { color: 'red' } } })
    // @ts-expect-error Descriptor rules are not selector/grouping blocks.
    global({ '@font-face': { body: { color: 'red' } } })
    // @ts-expect-error Selectors cannot enclose a font-face declaration.
    fontFace(
      { fontFamily: 'Body', src: 'local("Arial")' },
      { within: ['.card'] },
    )
    // @ts-expect-error Timeline ranges must use standard range names.
    keyframes({ 'unknown 0%': { opacity: 0 } })
  })
})
