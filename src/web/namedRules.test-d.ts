/** Verifies named stylesheet domains through public declaration authoring. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { css } from 'zyzz'
import {
  colorProfile,
  counterStyle,
  fontPaletteValues,
  positionTry,
} from 'zyzz/web'

describe('named rules', () => {
  test('retains identities and rejects references from other domains', () => {
    const dots = counterStyle({ system: 'cyclic', symbols: '"●"' })
    const palette = fontPaletteValues({ fontFamily: 'Body', basePalette: 0 })
    const fallback = positionTry({ positionArea: 'bottom' })
    const profile = colorProfile({ src: 'url(/profile.icc)' })
    expectTypeOf(dots).toEqualTypeOf<counterStyle.Reference>()
    expectTypeOf(profile).toEqualTypeOf<colorProfile.Reference>()
    css({
      listStyleType: dots,
      fontPalette: palette,
      positionTryFallbacks: fallback,
    })
    // @ts-expect-error A palette is not a counter style.
    css({ listStyleType: palette })
    // @ts-expect-error A counter style is not a palette.
    css({ fontPalette: dots })
    // @ts-expect-error Anchor fallbacks cannot set color.
    positionTry({ color: 'red' })
    // @ts-expect-error Font palette descriptors require a family.
    fontPaletteValues({ basePalette: 0 })
    // @ts-expect-error Counter fallback references must name counters.
    counterStyle({ fallback: palette })
  })
})
