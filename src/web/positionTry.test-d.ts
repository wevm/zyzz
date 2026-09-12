/** Checks positionTry through its public descriptor contract. @module */
import { describe, test, expectTypeOf } from 'vite-plus/test'
import { css } from 'zyzz'
import { positionTry } from 'zyzz/web'
describe('positionTry', () => {
  test('preserves its descriptor and identity domains', () => {
    expectTypeOf(
      positionTry({ positionArea: 'bottom' }),
    ).toEqualTypeOf<positionTry.Reference>()
    expectTypeOf(
      css({ '--fallback': positionTry({ positionArea: 'bottom' }) }),
    ).toBeFunction()
    // @ts-expect-error anchor fallbacks cannot set color
    positionTry({ color: 'red' })
  })
})
