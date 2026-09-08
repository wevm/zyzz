/**
 * Measures complete module rewriting, source maps, and generated delivery sizes.
 * @module
 */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Zlib from 'node:zlib'
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Compilation from '../../bench/Compilation.js'

for (const count of [10, 100, 1000]) {
  const source = `import { css } from 'zyzz';\n${Array.from({ length: count }, (_, index) => `export const card${index} = css({ color: '#fff', padding: '${index}px' });`).join('\n')}`
  describe(`module transform / ${count} styles`, () => {
    bench(
      'extract + emit + rewrite + maps',
      () => {
        Transform.compile({ moduleId: 'example/cards.ts', source })
      },
      {
        iterations: 3,
        setup: async () => {
          const output = Transform.compile({
            moduleId: 'example/cards.ts',
            source,
          })
          const bundle = await Esbuild.build({
            alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
            bundle: true,
            format: 'esm',
            minify: true,
            stdin: {
              contents: output.code,
              loader: 'ts',
              resolveDir: process.cwd(),
            },
            write: false,
          })
          const cssText = Compilation.minify(output.css)
          const javascriptText = bundle.outputFiles[0]!.text
          const measure = (value: string) => ({
            brotli: Zlib.brotliCompressSync(value).byteLength,
            gzip: Zlib.gzipSync(value).byteLength,
            raw: Buffer.byteLength(value),
          })
          const css = measure(cssText)
          const javascript = measure(javascriptText)
          const directory = Path.resolve('bench/results/transform')
          await Fs.mkdir(directory, { recursive: true })
          await Fs.writeFile(
            Path.join(directory, `${count}.json`),
            JSON.stringify(
              {
                composition: 'ordered',
                count,
                css,
                javascript,
                maps: {
                  css: measure(JSON.stringify(output.cssMap)),
                  javascript: measure(JSON.stringify(output.map)),
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
          await Fs.writeFile(Path.join(directory, `${count}.css`), cssText)
          await Fs.writeFile(
            Path.join(directory, `${count}.js`),
            javascriptText,
          )
        },
        time: 100,
        warmupIterations: 1,
        warmupTime: 50,
      },
    )
  })
}
