/**
 * Measures property-alias expansion through packed configuration consumption and its emitted delivery sizes.
 * @module
 */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Zlib from 'node:zlib'
import { bench, describe } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import * as Compilation from '../bench/Compilation.js'
import * as Mappings from '../test/fixtures/Mappings.js'

const library = Graph.compile({
  modules: {
    'config.ts': Mappings.config,
    'index.ts': `export {css,theme} from './config.js';`,
  },
})
const contracts = { 'library/index.js': library.contracts['index.ts']! }
const imports = { 'app.ts': { library: 'library/index.js' } }

for (const count of [10, 100]) {
  const modules = {
    'app.ts':
      Mappings.source +
      Array.from(
        { length: count },
        (_, index) =>
          `\nexport const mapped${index} = css({px:'sm',paddingX:'sm!',space:'sm',paddingLeft:'${index}px'})();`,
      ).join(''),
  }

  describe(`property mapping transform / ${count} additional styles`, () => {
    bench(
      'read contracts + extract + emit + rewrite + maps',
      () => {
        Graph.compile({ contracts, imports, modules })
      },
      {
        iterations: 30,
        setup: async () => {
          const output = Graph.compile({ contracts, imports, modules })
          const directory = await Fs.mkdtemp(
            Path.resolve('.fixture-mappings-bench-'),
          )

          try {
            const packageDirectory = Path.join(
              directory,
              'node_modules/library',
            )

            await Fs.mkdir(packageDirectory, { recursive: true })
            await Fs.writeFile(
              Path.join(packageDirectory, 'package.json'),
              JSON.stringify({
                exports: './index.js',
                name: 'library',
                type: 'module',
              }),
            )
            await Fs.writeFile(
              Path.join(packageDirectory, 'index.js'),
              (
                await Esbuild.transform(library.modules['config.ts']!.code, {
                  format: 'esm',
                  loader: 'ts',
                })
              ).code,
            )
            await Fs.writeFile(
              Path.join(directory, 'app.ts'),
              output.modules['app.ts']!.code,
            )

            const bundle = await Esbuild.build({
              alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
              bundle: true,
              entryPoints: [Path.join(directory, 'app.ts')],
              format: 'esm',
              minify: true,
              write: false,
            })

            const measure = (value: string) => ({
              brotli: Zlib.brotliCompressSync(value).byteLength,
              gzip: Zlib.gzipSync(value).byteLength,
              raw: Buffer.byteLength(value),
            })

            const css = measure(
              Compilation.minify(
                [
                  library.modules['config.ts']!.css,
                  output.modules['app.ts']!.css,
                ]
                  .filter(Boolean)
                  .join('\n'),
              ),
            )
            const javascript = measure(bundle.outputFiles[0]!.text)

            await Fs.mkdir('bench/results/mappings', { recursive: true })
            await Fs.writeFile(
              `bench/results/mappings/${count}.json`,
              JSON.stringify(
                {
                  count,
                  css,
                  javascript,
                  maps: {
                    css: measure(
                      JSON.stringify(output.modules['app.ts']!.cssMap),
                    ),
                    javascript: measure(
                      JSON.stringify(output.modules['app.ts']!.map),
                    ),
                  },
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
          } finally {
            await Fs.rm(directory, { recursive: true, force: true })
          }
        },
        time: 1000,
        warmupIterations: 10,
        warmupTime: 500,
      },
    )
  })
}
