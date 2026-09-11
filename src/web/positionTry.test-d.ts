/** Checks positionTry through its public descriptor contract. @module */
import { describe, test, expectTypeOf } from 'vite-plus/test'
import { positionTry } from 'zyzz/web'
describe('positionTry', () => {
  test('preserves its descriptor and identity domains', () => {
    expectTypeOf(
      positionTry({ positionArea: 'bottom' }),
    ).toEqualTypeOf<positionTry.Reference>()
    // @ts-expect-error anchor fallbacks cannot set color
    positionTry({ color: 'red' })
  })
})
