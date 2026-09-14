/**
 * Measures pure theme emission and stylesheet sizes before final processing.
 * @module
 */
import * as Fs from 'node:fs/promises'
import * as Zlib from 'node:zlib'
import { bench, describe } from 'vite-plus/test'
import { Style, Theme } from 'zyzz'
import { Css } from 'zyzz/web'

for (const count of [10, 100]) {
  const theme = Theme.define({
    color: { brand: { dark: '#fff', light: '#000' } },
    spacing: { md: '8px' },
  })
  const alternate = Theme.extend(theme, { spacing: { md: '16px' } })

  const styles = Style.define(
    Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        `card-${index}`,
        {
          color: theme.tokens.color.brand,
          padding: theme.tokens.spacing.md,
          width: `${index}px` as const,
        },
      ]),
    ),
  )

  const output = Css.compile({
    composition: 'independent',
    cssOutput: 'grouped',
    styles,
    themes: { alternate, base: theme },
  })

  await Fs.mkdir('bench/results/themes', { recursive: true })
  await Fs.writeFile(
    `bench/results/themes/${count}.json`,
    JSON.stringify({
      brotli: Zlib.brotliCompressSync(output.css).length,
      count,
      gzip: Zlib.gzipSync(output.css).length,
      raw: Buffer.byteLength(output.css),
    }),
  )
  describe(`theme compilation / ${count} styles`, () => {
    bench('two scopes with scheme pairs', () => {
      Css.compile({
        composition: 'independent',
        cssOutput: 'grouped',
        styles,
        themes: { alternate, base: theme },
      })
    })
  })
}
