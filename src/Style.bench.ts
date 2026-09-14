/**
 * Measures complete theme shorthand resolution and CSS emission against explicit references.
 * @module
 */
import { bench, describe } from 'vite-plus/test'
import { Style, Theme } from 'zyzz'
import { Css } from 'zyzz/web'

for (const count of [10, 100]) {
  const theme = Theme.define({
    color: { brand: '#06c' },
    spacing: { md: '8px' },
  })

  const explicit = Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `card-${index}`,
      {
        color: theme.tokens.color.brand,
        padding: theme.tokens.spacing.md,
        width: `${index}px` as const,
      },
    ]),
  )

  const named = Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `card-${index}`,
      {
        color: 'brand' as const,
        padding: 'md' as const,
        width: `${index}px` as const,
      },
    ]),
  )

  describe(`theme resolution and compilation / ${count} styles`, () => {
    bench('explicit references', () => {
      Css.compile({
        cssOutput: 'grouped',
        styles: Style.define(explicit),
        themes: { base: theme },
      })
    })
    bench('inferred token names', () => {
      Css.compile({
        cssOutput: 'grouped',
        styles: Style.define(named, { theme }),
        themes: { base: theme },
      })
    })
  })
}
