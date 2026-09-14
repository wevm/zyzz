/** Measures direct and bound composition over verified integration projects. @module */
import * as Esbuild from 'esbuild'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs/promises'
import * as Os from 'node:os'
import * as Zlib from 'node:zlib'
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Fixture from '../test/fixtures/composition.js'

function bytes(value: string) {
  return {
    brotli: Zlib.brotliCompressSync(value).length,
    gzip: Zlib.gzipSync(value).length,
    raw: Buffer.byteLength(value),
  }
}
const measurements: object[] = []
let retained: unknown
for (const workload of Fixture.cases) {
  for (const output of ['react', 'html'] as const) {
    for (const conditional of [false, true]) {
      for (const binding of [false, true]) {
        const source = Fixture.source({
          binding,
          conditional,
          output,
          workload,
        })
        const options = { moduleId: `composition-${workload.name}.ts`, source }
        const compiled = Transform.compile({
          ...options,
          composition: 'independent',
          cssOutput: 'grouped',
        })
        const bundled = await Esbuild.build({
          alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
          bundle: true,
          format: 'esm',
          metafile: true,
          minify: true,
          stdin: {
            contents: compiled.code,
            loader: 'ts',
            resolveDir: process.cwd(),
          },
          write: false,
        })
        const helperImport = compiled.code.match(
          /import \{[^}]+\} from 'zyzz\/runtime';/,
        )?.[0]
        const helperBundle = helperImport
          ? await Esbuild.build({
              alias: {
                'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts`,
              },
              bundle: true,
              format: 'esm',
              minify: true,
              stdin: {
                contents: helperImport.replace('import', 'export'),
                loader: 'ts',
                resolveDir: process.cwd(),
              },
              write: false,
            })
          : undefined
        const helperArtifact = helperBundle?.outputFiles?.[0]?.text
        const code = bundled.outputFiles![0]!.text
        const module = (await import(
          `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
        )) as {
          apply: (enabled?: boolean) => readonly Record<string, unknown>[]
        }
        const props = module.apply(true)
        const classes = props
          .map((value) => String(value.className ?? value.class))
          .join(' ')
        const markup = props
          .map(
            (value) => `<div class="${value.className ?? value.class}"></div>`,
          )
          .join('')
        const css = bytes(compiled.css)
        const javascript = bytes(code)
        const html = bytes(markup)
        const helpers = Object.entries(bundled.metafile!.outputs).flatMap(
          ([, entry]) =>
            Object.entries(entry.inputs)
              .filter(([path]) => path.includes('/runtime/'))
              .map(([path, input]) => ({
                bytesInOutput: input.bytesInOutput,
                path,
              })),
        )
        const name = `${workload.name}/${output}/${conditional ? 'conditional' : 'static'}/${binding ? 'bound' : 'direct'}`
        measurements.push({
          classes: bytes(classes),
          count: workload.count,
          css,
          helpers,
          helperArtifact: helperArtifact
            ? bytes(helperArtifact)
            : { brotli: 0, gzip: 0, raw: 0 },
          javascript,
          markup: html,
          name,
          sourceSha256: Crypto.createHash('sha256')
            .update(source)
            .digest('hex'),
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
        describe(`cx / ${name}`, () => {
          bench(
            'compile',
            () => {
              Transform.compile({
                ...options,
                composition: 'independent',
                cssOutput: 'grouped',
              })
            },
            { time: 250, warmupTime: 100 },
          )
          bench(
            'apply project',
            () => {
              retained = module.apply()
            },
            { time: 250, warmupTime: 100 },
          )
        })
      }
    }
  }
}
void retained
await Fs.mkdir('bench/results', { recursive: true })
await Fs.writeFile(
  'bench/results/composition-bindings-metadata.json',
  JSON.stringify(
    {
      architecture: process.arch,
      cache:
        'warm in-process compilation; module initialization excluded from apply',
      cpu: Os.cpus()[0]?.model,
      date: new Date().toISOString(),
      esbuild: Esbuild.version,
      measurements,
      node: process.version,
      platform: process.platform,
      timeMs: 250,
      warmupMs: 100,
    },
    null,
    2,
  ) + '\n',
)
