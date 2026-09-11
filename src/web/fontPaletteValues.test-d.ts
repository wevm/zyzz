/** Checks fontPaletteValues through its public descriptor contract. @module */
import { describe, test, expectTypeOf } from 'vite-plus/test'
import { fontPaletteValues } from 'zyzz/web'
describe('fontPaletteValues', () => {
  test('preserves its descriptor and identity domains', () => {
    expectTypeOf(
      fontPaletteValues({ fontFamily: 'Body', basePalette: 0 }),
    ).toEqualTypeOf<fontPaletteValues.Reference>()
    // @ts-expect-error font family is required
    fontPaletteValues({ basePalette: 0 })
  })
})

describe('fontPaletteValues', () => {
  test('covers descriptor inventory and context errors', () => {
    fontPaletteValues({
      basePalette: 'light',
      fontFamily: 'Evidence',
      overrideColors: '0 red, 1 blue',
    })
  })
})
