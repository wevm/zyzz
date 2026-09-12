/** Checks counterStyle through its public descriptor contract. @module */
import { describe, test, expectTypeOf } from 'vite-plus/test'
import { counterStyle, fontPaletteValues } from 'zyzz/web'
describe('counterStyle', () => {
  test('preserves its descriptor and identity domains', () => {
    const dots = counterStyle({ system: 'fixed -1', symbols: '"x"' })
    expectTypeOf(dots).toEqualTypeOf<counterStyle.Reference>()
    const palette = fontPaletteValues({ fontFamily: 'Body' })
    // @ts-expect-error fallback requires a counter identity
    counterStyle({ symbols: '"x"', fallback: palette })
    // @ts-expect-error symbols are required by the default system
    counterStyle({})
    // @ts-expect-error fixed needs an integer
    counterStyle({ system: 'fixed nonsense', symbols: '"x"' })
    // @ts-expect-error fixed needs a token boundary
    counterStyle({ system: 'fixedfoo', symbols: '"x"' })
    // @ts-expect-error additive systems require additiveSymbols
    counterStyle({ system: 'additive' })
  })
})
