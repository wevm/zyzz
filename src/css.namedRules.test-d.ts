/** Checks named stylesheet identities in public css declarations. @module */
import { describe, test } from 'vite-plus/test'
import { css } from 'zyzz'
import { counterStyle, fontPaletteValues, positionTry } from 'zyzz/web'
describe('css', () => {
  test('rejects identities from unrelated domains', () => {
    const dots = counterStyle({ symbols: '"x"' })
    const palette = fontPaletteValues({ fontFamily: 'Body', basePalette: 0 })
    const below = positionTry({ positionArea: 'bottom' })
    css({
      listStyleType: dots,
      fontPalette: palette,
      positionTryFallbacks: below,
    })
    // @ts-expect-error palette is not a counter
    css({ listStyleType: palette })
    // @ts-expect-error counter is not a palette
    css({ fontPalette: dots })
  })
})
