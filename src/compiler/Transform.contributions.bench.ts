/** Measures the public shared stylesheet graph workflow and its delivery sizes. @module */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Zlib from 'node:zlib'
import { bench, describe } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import * as Compilation from '../../bench/Compilation.js'

const modules = {
  'app.ts': 'import {css} from "zyzz"; export const box=css({color:"red"})()',
  'global.ts':
    'import {global,keyframes,layers} from "zyzz/web"; layers(["reset","base"]); global({body:{margin:0}}); export const fade=keyframes({from:{opacity:0},to:{opacity:1}})',
}
describe('stylesheet contributions', () => {
  bench(
    'compile shared graph',
    () => {
      Graph.compile({ modules })
    },
    {
      setup: async () => {
        const output = Graph.compile({ modules })

        const bundles = await Promise.all(
          Object.entries(output.modules).map(([name, module]) =>
            Esbuild.build({
              alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
              bundle: true,
              format: 'esm',
              minify: true,
              stdin: {
                contents: module.code,
                loader: 'ts',
                resolveDir: process.cwd(),
                sourcefile: name,
              },
              write: false,
            }),
          ),
        )

        const measure = (value: string) => ({
          brotli: Zlib.brotliCompressSync(value).byteLength,
          gzip: Zlib.gzipSync(value).byteLength,
          raw: Buffer.byteLength(value),
        })

        const shared = measure(Compilation.minify(output.sharedCss ?? ''))
        const css = measure(
          Compilation.minify(
            Object.values(output.modules)
              .map((module) => module.css)
              .filter(Boolean)
              .join('\n'),
          ),
        )
        const javascript = measure(
          bundles.map((bundle) => bundle.outputFiles[0]!.text).join(''),
        )
        const metadata = measure(Object.values(output.contracts).join(''))

        await Fs.mkdir('bench/results/contributions', { recursive: true })
        await Fs.writeFile(
          'bench/results/contributions/delivery.json',
          JSON.stringify(
            {
              css,
              javascript,
              metadata,
              shared,
              total: {
                brotli: shared.brotli + css.brotli + javascript.brotli,
                gzip: shared.gzip + css.gzip + javascript.gzip,
                raw: shared.raw + css.raw + javascript.raw,
              },
            },
            null,
            2,
          ),
        )
      },
      time: 200,
      warmupTime: 100,
    },
  )
})
