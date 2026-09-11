/**
 * Measures literal compiler throughput and complete CSS/client delivery sizes.
 * @module
 */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Zlib from 'node:zlib'
import { bench, describe } from 'vite-plus/test'
import * as Compilation from './Compilation.js'
import * as Corpus from './Corpus.js'

for (const workload of Corpus.cases) {
  describe(`fresh compilation / ${workload.name}`, () => {
    for (const [library, compile] of Object.entries(Compilation.compilers)) {
      let fixture: Compilation.Fixture
      bench(
        library,
        async () => {
          await compile(fixture)
        },
        {
          // Require enough independent samples that one scheduler stall cannot dominate a 100ms lane.
          iterations: 20,
          time: 1000,
          warmupIterations: 3,
          warmupTime: 300,
          // Tinybench setup/teardown run outside timing; Vitest suite hooks are not supported.
          setup: async () => {
            fixture = await Compilation.create(workload)
            try {
              const bundle = await compile(fixture)
              const directory = Path.resolve('bench/results', workload.name)
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
                    application: 'independent',
                    components: workload.count,
                    css,
                    declarations: fixture.zyzz.styles.reduce(
                      (total, style) => total + style.declarations.length,
                      0,
                    ),
                    javascript,
                    library,
                    minification: Compilation.minification,
                    targets: fixture.targets,
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
