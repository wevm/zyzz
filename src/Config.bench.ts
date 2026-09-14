/**
 * Measures configuration normalization through in-memory style and CSS emission.
 * @module
 */
import { bench, describe } from 'vite-plus/test'
import { Config, Style } from 'zyzz'
import { Css } from 'zyzz/web'

for (const count of [10, 100]) {
  const styles = Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `card${index}`,
      { color: 'brand' as const, padding: `${index}px` as const },
    ]),
  )

  describe(`configuration / ${count} styles`, () => {
    bench(
      'normalize + validate + emit',
      () => {
        const zyzz = Config.create({
          defaultTheme: 'base',
          themes: {
            base: { color: { brand: { light: '#06c', dark: '#9cf' } } },
            mint: { color: { brand: { light: '#175', dark: '#afa' } } },
          },
        })

        Css.compile({
          cssOutput: 'grouped',
          styles: Style.define(styles, { theme: zyzz.themes.base }),
          themes: zyzz.themes,
        })
      },
      { iterations: 30, time: 1000, warmupIterations: 10, warmupTime: 500 },
    )
  })
}
