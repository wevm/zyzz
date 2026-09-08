/** Measures linked source compilation using the integration module graph. */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Zlib from 'node:zlib'
import { bench, describe } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import * as Fixture from '../../test/fixtures/ThemeGraph.js'
import * as Compilation from '../../bench/Compilation.js'

for (const count of [10, 100]) {
  const modules = {
    ...Fixture.modules,
    'pkg/card.ts': `import { style } from './index.js'; ${Array.from({ length: count }, (_, index) => `export const props${index} = style({color:'brand',padding:'${index}px'})();`).join('\n')}`,
  }
  describe(`theme graph / ${count} styles`, () => {
    bench(
      'link + extract + emit + rewrite + maps',
      () => {
        Graph.compile({ modules })
      },
      {
        iterations: 30,
        time: 1000,
        warmupIterations: 10,
        warmupTime: 500,
        setup: async () => {
          const output = Graph.compile({ modules })
          const directory = await Fs.mkdtemp(
            Path.resolve('.fixture-graph-bench-'),
          )
          try {
            for (const [name, module] of Object.entries(output.modules)) {
              const path = Path.join(directory, name)
              await Fs.mkdir(Path.dirname(path), { recursive: true })
              await Fs.writeFile(path, module.code)
            }
            const bundle = await Esbuild.build({
              entryPoints: [Path.join(directory, 'pkg/card.ts')],
              bundle: true,
              format: 'esm',
              minify: true,
              write: false,
            })
            const measure = (value: string) => ({
              raw: Buffer.byteLength(value),
              gzip: Zlib.gzipSync(value).byteLength,
              brotli: Zlib.brotliCompressSync(value).byteLength,
            })
            const css = measure(
              Compilation.minify(
                Object.values(output.modules)
                  .map((module) => module.css)
                  .join('\n'),
              ),
            )
            const javascript = measure(bundle.outputFiles[0]!.text)
            await Fs.mkdir('bench/results/graph', { recursive: true })
            await Fs.writeFile(
              `bench/results/graph/${count}-sizes.json`,
              JSON.stringify({
                count,
                css,
                javascript,
                total: {
                  raw: css.raw + javascript.raw,
                  gzip: css.gzip + javascript.gzip,
                  brotli: css.brotli + javascript.brotli,
                },
              }),
            )
          } finally {
            await Fs.rm(directory, { recursive: true, force: true })
          }
          await Fs.mkdir('bench/results/graph', { recursive: true })
          await Fs.writeFile(
            `bench/results/graph/${count}.json`,
            JSON.stringify(output),
          )
        },
      },
    )
  })
}
