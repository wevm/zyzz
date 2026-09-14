/**
 * Measures matched theme compilation and complete CSS/client delivery sizes.
 * @module
 */
import * as Fs from 'node:fs/promises'
import * as Zlib from 'node:zlib'
import { bench, describe } from 'vite-plus/test'
import * as Themes from './Themes.js'

for (const count of [10, 100]) {
  describe(`theme comparison / ${count} styles`, () => {
    for (const [library, compile] of Object.entries(Themes.compilers)) {
      let fixture: Themes.Fixture

      bench(
        library,
        async () => {
          await compile(fixture)
        },
        {
          // Keep short theme lanes from being dominated by a single scheduler stall.
          iterations: 20,
          time: 1000,
          warmupIterations: 3,
          warmupTime: 300,
          setup: async () => {
            fixture = await Themes.create(count)

            try {
              const bundle = await compile(fixture)

              const measure = (value: string) => ({
                brotli: Zlib.brotliCompressSync(value).length,
                gzip: Zlib.gzipSync(value).length,
                raw: Buffer.byteLength(value),
              })

              const css = measure(bundle.css)
              const javascript = measure(bundle.javascript)
              const directory = `bench/results/theme-comparison/${count}`

              await Fs.mkdir(directory, { recursive: true })
              await Fs.writeFile(`${directory}/${library}.css`, bundle.css)
              await Fs.writeFile(
                `${directory}/${library}.js`,
                bundle.javascript,
              )
              await Fs.writeFile(
                `${directory}/${library}.json`,
                JSON.stringify({
                  count,
                  css,
                  cssOutput: library.startsWith('zyzz') ? 'grouped' : undefined,
                  javascript,
                  library,
                  targets: fixture.targets,
                  total: {
                    brotli: css.brotli + javascript.brotli,
                    gzip: css.gzip + javascript.gzip,
                    raw: css.raw + javascript.raw,
                  },
                }),
              )
            } catch (error) {
              await Fs.rm(fixture.directory, { force: true, recursive: true })
              throw error
            }
          },
          teardown: async () => {
            const directory = fixture.directory

            await Fs.rm(directory, { force: true, recursive: true })
          },
        },
      )
    }
  })
}
