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

for (const kind of ['literal', 'theme', 'alias', 'tokens'] as const)
  for (const count of [10, 100, 1000]) {
    const header =
      kind !== 'literal'
        ? `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#fff' } }); const alternate = Theme.extend(theme, { color: { brand: '#000' } }); export const scope = alternate.className;`
        : `import { css } from 'zyzz';`
    const source = `${header}\n${kind === 'alias' ? 'const { css } = theme;' : ''}\n${Array.from({ length: count }, (_, index) => `export const card${index} = ${kind === 'theme' || kind === 'tokens' ? 'theme.css' : 'css'}({ color: ${kind === 'tokens' ? 'theme.tokens.color.brand' : kind !== 'literal' ? "'brand'" : "'#fff'"}, padding: '${index}px' });`).join('\n')}`
    describe(`${kind === 'tokens' ? 'theme token transform' : kind === 'alias' ? 'theme alias transform' : kind === 'theme' ? 'theme source transform' : 'module transform'} / ${count} styles`, () => {
      bench(
        'extract + emit + rewrite + maps',
        () => {
          Transform.compile({ moduleId: 'example/cards.ts', source })
        },
        {
          iterations: 30,
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
              Path.join(directory, `${kind}-${count}.json`),
              JSON.stringify(
                {
                  composition: 'ordered',
                  count,
                  css,
                  javascript,
                  kind,
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
            await Fs.writeFile(
              Path.join(directory, `${kind}-${count}.css`),
              cssText,
            )
            await Fs.writeFile(
              Path.join(directory, `${kind}-${count}.js`),
              javascriptText,
            )
          },
          time: 1000,
          warmupIterations: 10,
          warmupTime: 500,
        },
      )
    })
  }
