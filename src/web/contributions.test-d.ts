/** Verifies literal stylesheet contribution contracts through public entrypoints. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Theme } from 'zyzz'
import { Css, fontFace, global, keyframes } from 'zyzz/web'
describe('stylesheet contributions', () => {
  test('accepts checked literals and theme variables', () => {
    const theme = Theme.define({ color: { ink: 'red' } })
    global({
      body: { color: theme.vars.color.ink, padding: '2px' },
      '@layer reset': { '*': { margin: 0 } },
    })
    fontFace({ fontFamily: 'App', src: 'url(/app.woff2)', fontDisplay: 'swap' })
    expectTypeOf(
      keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }),
    ).toEqualTypeOf<string>()
    Css.layers(['reset', 'base'])
    // @ts-expect-error Unknown declarations remain invalid.
    global({ body: { unknown: true } })
    // @ts-expect-error Negative padding is invalid.
    global({ body: { padding: '-1px' } })
    // @ts-expect-error Font sources are required.
    fontFace({ fontFamily: 'App' })
    // @ts-expect-error Frame keys must be stop positions.
    keyframes({ middle: { opacity: 0 } })
  })
})
