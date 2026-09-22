/** Checks counterStyle through its public descriptor contract. @module */
import { counterStyle, fontPaletteValues } from 'zyzz/web'
import { describe, test, expectTypeOf } from 'vite-plus/test'
describe('counterStyle', () => {
  test('preserves its descriptor and identity domains', () => {
    counterStyle({ system: ' ADDITIVE ', additiveSymbols: '1 "I"' })
    counterStyle({ system: '\\63 yclic', symbols: '"x"' })
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

describe('counterStyle', () => {
  test('covers descriptor inventory and context errors', () => {
    counterStyle({
      system: 'additive',
      additiveSymbols: '10 "X", 1 "I"',
      fallback: 'decimal',
      negative: '"(" ")"',
      pad: '2 "0"',
      prefix: '"["',
      range: '1 99',
      speakAs: 'numbers',
      suffix: '"]"',
      symbols: '"I"',
    })
    counterStyle({
      system: 'cyclic',
      symbols: '"x"',
      // @ts-expect-error a palette reference cannot select a counter fallback
      fallback: fontPaletteValues({ fontFamily: 'Evidence', basePalette: 0 }),
    })
  })
})

describe('counterStyle', () => {
  test('accepts nested group keys and rejects legacy contexts', () => {
    counterStyle({
      '@layer definitions': {
        '@media screen': { system: 'numeric', symbols: '"0" "1"' },
      },
    })
    // @ts-expect-error selectors cannot enclose a declaration
    counterStyle({ '.card': { system: 'numeric', symbols: '"0" "1"' } })
    counterStyle(
      { system: 'numeric', symbols: '"0" "1"' },
      // @ts-expect-error enclosing groups belong in the definition
      { within: ['@layer definitions'] },
    )
  })
})
