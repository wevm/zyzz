import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Zlib from 'node:zlib'
import { bench, describe } from 'vite-plus/test'
import * as Compilation from './Compilation.js'

for (const [name, count, unique] of [
  ['small', 3, false],
  ['repeated', 1000, false],
  ['unique', 1000, true],
] as const) {
  describe(`fresh compilation / ${name}`, () => {
    for (const [library, compile] of [
      ['stylex', Compilation.stylex],
      ['tailwind', Compilation.tailwind],
      ['vanilla-extract', Compilation.vanillaExtract],
      ['zyzz', Compilation.zyzz],
    ] as const) {
      let fixture: Compilation.Fixture
      bench(
        library,
        async () => {
          await compile(fixture)
        },
        {
          // Tinybench setup/teardown run outside timing; Vitest suite hooks are not supported.
          setup: async () => {
            fixture = await Compilation.create(count, unique)
            try {
              const bundle = await compile(fixture)
              const directory = Path.resolve('bench/results', name)
              await Fs.mkdir(directory, { recursive: true })
              await Fs.writeFile(
                Path.join(directory, `${library}.css`),
                bundle.css,
              )
              // Generated delivery artifacts are not repository source.
              await Fs.writeFile(
                Path.join(directory, `${library}.js`),
                bundle.javascript,
              )
              const measure = (value: string) => ({
                brotli: Zlib.brotliCompressSync(value).byteLength,
                gzip: Zlib.gzipSync(value).byteLength,
                raw: Buffer.byteLength(value),
              })
              const css = measure(bundle.css)
              const javascript = measure(bundle.javascript)
              await Fs.writeFile(
                Path.join(directory, `${library}.json`),
                JSON.stringify(
                  {
                    components: count,
                    css,
                    declarationsPerComponent: 8,
                    javascript,
                    library,
                    total: {
                      brotli: css.brotli + javascript.brotli,
                      gzip: css.gzip + javascript.gzip,
                      raw: css.raw + javascript.raw,
                    },
                  },
                  null,
                  2,
                ),
              )
            } catch (error) {
              await Fs.rm(fixture.directory, { force: true, recursive: true })
              throw error
            }
          },
          teardown: async () => {
            await Fs.rm(fixture.directory, { force: true, recursive: true })
          },
        },
      )
    }
  })
}
