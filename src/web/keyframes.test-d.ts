/** Checks keyframes authoring contexts through the public API. @module */
import { describe, test, expectTypeOf } from 'vite-plus/test'
import { keyframes } from 'zyzz/web'
describe('keyframes', () => {
  test('checks grouping contexts', () => {
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
