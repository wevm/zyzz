/** Checks positionTry through its public descriptor contract. @module */
import { describe, test, expectTypeOf } from 'vite-plus/test'
import { style } from 'zyzz'
import { positionTry } from 'zyzz/web'
describe('positionTry', () => {
  test('preserves its descriptor and identity domains', () => {
    expectTypeOf(
      positionTry({ positionArea: 'bottom' }),
    ).toEqualTypeOf<positionTry.Reference>()
    expectTypeOf(
      style({ '--fallback': positionTry({ positionArea: 'bottom' }) }),
    ).toBeFunction()
    // @ts-expect-error anchor fallbacks cannot set color
    positionTry({ color: 'red' })
  })
})

describe('positionTry', () => {
  test('covers descriptor inventory and context errors', () => {
    positionTry({
      positionAnchor: '--target',
      positionArea: 'top',
      margin: '2px',
      inset: 'auto',
      width: '10px',
      maxHeight: '30px',
      alignSelf: 'center',
      justifySelf: 'center',
    })
  })
})
