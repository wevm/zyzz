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
import * as Flex from '../../test/fixtures/Flex.js'
import * as Declarations from '../../test/fixtures/Declarations.js'
import * as Lengths from '../../test/fixtures/Lengths.js'
import * as Logical from '../../test/fixtures/Logical.js'
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

for (const count of [10, 100]) {
  const source =
    Declarations.source +
    Array.from(
      { length: count },
      (_, index) =>
        `export const fallback${index} = css({color:['#000','brand!'],padding:['0px','${index}px']})();`,
    ).join('\n')
  describe(`fallback transform / ${count} additional styles`, () => {
    bench(
      'extract + emit + rewrite + maps',
      () => {
        Transform.compile({ moduleId: 'example/fallbacks.ts', source })
      },
      { iterations: 30, time: 1000, warmupIterations: 10, warmupTime: 500 },
    )
  })
}

for (const kind of ['flex', 'logical'] as const)
  for (const count of [10, 100]) {
    const source =
      (kind === 'logical' ? Logical.source : Flex.source) +
      Array.from({ length: count }, (_, index) =>
        kind === 'logical'
          ? `export const box${index} = css({inlineSize:'${index}px',paddingInline:['1px','2px!'],marginBlock:'-1px',insetBlockStart:0})();`
          : `export const box${index} = css({flexBasis:'${index}px',alignSelf:'center',order:${index},overflow:['hidden','clip!'],overflowX:'auto'})();`,
      ).join('\n')
    describe(`${kind === 'logical' ? 'logical box' : 'flex layout'} transform / ${count} additional styles`, () => {
      bench(
        'extract + emit + rewrite + maps',
        () => {
          Transform.compile({ moduleId: `example/${kind}.ts`, source })
        },
        {
          iterations: 30,
          setup: async () => {
            const output = Transform.compile({
              moduleId: `example/${kind}.ts`,
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
            const measure = (text: string) => ({
              brotli: Zlib.brotliCompressSync(text).byteLength,
              gzip: Zlib.gzipSync(text).byteLength,
              raw: Buffer.byteLength(text),
            })
            const css = measure(Compilation.minify(output.css))
            const javascript = measure(bundle.outputFiles[0]!.text)
            await Fs.mkdir('bench/results/transform', { recursive: true })
            await Fs.writeFile(
              `bench/results/transform/${kind}-${count}.json`,
              JSON.stringify(
                {
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
          },
          time: 1000,
          warmupIterations: 10,
          warmupTime: 500,
        },
      )
    })
  }

for (const count of [10, 100]) {
  const source =
    Lengths.source +
    Array.from(
      { length: count },
      (_, index) =>
        `export const length${index} = css({width:['50vw','${index}cqi!'],padding:'1lh',height:'10dvh'})();`,
    ).join('\n')
  describe(`standard length transform / ${count} additional styles`, () => {
    bench(
      'extract + emit + rewrite + maps',
      () => {
        Transform.compile({ moduleId: 'example/lengths.ts', source })
      },
      { iterations: 30, time: 1000, warmupIterations: 10, warmupTime: 500 },
    )
  })
}
