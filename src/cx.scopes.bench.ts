/** Measures scope composition against equivalent manual props with complete delivery accounting. @module */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Os from 'node:os'
import * as Zlib from 'node:zlib'
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Scopes from '../test/fixtures/scopes.js'

function bytes(value: string) {
  return {
    brotli: Zlib.brotliCompressSync(value).length,
    gzip: Zlib.gzipSync(value).length,
    raw: Buffer.byteLength(value),
  }
}
const measurements: object[] = []
let retained: unknown
for (const output of ['react', 'html'] as const) {
  for (const composition of ['manual', 'cx'] as const) {
    const options = {
      moduleId: 'scope.ts',
      source: Scopes.source(output, composition),
    }
    const compiled = Transform.compile(options)
    const bundled = await Esbuild.build({
      alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
      bundle: true,
      format: 'iife',
      globalName: 'Fixture',
      metafile: true,
      minify: true,
      stdin: {
        contents: compiled.code,
        loader: 'ts',
        resolveDir: process.cwd(),
      },
      write: false,
    })
    const code = bundled.outputFiles[0]!.text
    const initialize = new Function(`${code};return Fixture;`) as () => {
      apply: (scheme: 'light' | 'dark') => Record<string, unknown>
    }
    const module = initialize()
    const props = module.apply('dark')
    const classes = String(props.className ?? props.class)
    const markup = `<div class="${classes}" style="color-scheme:dark"></div>`
    const css = bytes(compiled.css)
    const javascript = bytes(code)
    const html = bytes(markup)
    measurements.push({
      classes: bytes(classes),
      composition,
      css,
      helpers: Object.values(bundled.metafile!.outputs).flatMap((entry) =>
        Object.entries(entry.inputs)
          .filter(([path]) => path.includes('/runtime/'))
          .map(([path, input]) => ({
            bytesInOutput: input.bytesInOutput,
            path,
          })),
      ),
      javascript,
      markup: html,
      output,
      transfer: {
        client: {
          brotli: css.brotli + javascript.brotli,
          gzip: css.gzip + javascript.gzip,
          raw: css.raw + javascript.raw,
        },
        hydrated: {
          brotli: css.brotli + javascript.brotli + html.brotli,
          gzip: css.gzip + javascript.gzip + html.gzip,
          raw: css.raw + javascript.raw + html.raw,
        },
      },
    })
    describe(`cx / variable scopes / ${output} / ${composition}`, () => {
      bench(
        'compile',
        () => {
          retained = Transform.compile(options)
        },
        { time: 1000, warmupTime: 300 },
      )
      bench(
        'initialize',
        () => {
          retained = initialize()
        },
        { time: 1000, warmupTime: 300 },
      )
      bench(
        'apply',
        () => {
          retained = module.apply('dark')
        },
        { time: 1000, warmupTime: 300 },
      )
    })
  }
}
void retained
await Fs.mkdir('bench/results', { recursive: true })
await Fs.writeFile(
  'bench/results/composition-scopes.json',
  JSON.stringify(
    {
      architecture: process.arch,
      cache:
        'warm compilation; initialization excludes parsing; apply excludes initialization',
      cpu: Os.cpus()[0]?.model,
      date: new Date().toISOString(),
      esbuild: Esbuild.version,
      measurements,
      node: process.version,
      platform: process.platform,
      timeMs: 1000,
      warmupMs: 300,
    },
    null,
    2,
  ) + '\n',
)
