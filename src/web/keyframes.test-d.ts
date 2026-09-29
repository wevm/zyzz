/** Checks keyframes authoring contexts through the public API. @module */
import { describe, test, expectTypeOf } from 'vite-plus/test'
import { keyframes } from 'zyzz/web'
describe('keyframes', () => {
  test('accepts escaped keywords exponent offsets and unrestricted named ranges', () => {
    keyframes({
      '\\66 rom': { opacity: 0 },
      '1e2%': { opacity: 1 },
      'ENTRY -20%': { opacity: 0 },
      'cover 150%': { opacity: 1 },
    })
  })
})

describe('keyframes', () => {
  test('checks grouping contexts', () => {
    keyframes({ 'entry\t0%': { opacity: 0 }, 'exit\n100%': { opacity: 1 } })
    expectTypeOf(
      keyframes(
        { 'entry 0%': { opacity: 0 }, 'exit 100%': { opacity: 1 } },
        undefined,
      ),
    ).toEqualTypeOf<string>()
    // @ts-expect-error invalid timeline range
    keyframes({ 'unknown 0%': { opacity: 0 } })
  })
})

describe('keyframes', () => {
  test('accepts nested group keys and rejects legacy contexts', () => {
    keyframes({
      '@layer definitions': {
        '@media screen': { from: { opacity: 0 }, to: { opacity: 1 } },
      },
    })
    // @ts-expect-error nested groups still validate frame stops
    keyframes({ '@layer motion': { 'unknown 0%': { opacity: 0 } } })
    // @ts-expect-error selectors cannot enclose a declaration
    keyframes({ '.card': { from: { opacity: 0 }, to: { opacity: 1 } } })
    keyframes(
      { from: { opacity: 0 }, to: { opacity: 1 } },
      // @ts-expect-error enclosing groups belong in the definition
      { within: ['@layer definitions'] },
    )
  })
})
