/** Compares compiled direct and bound props composition with matched rendering inputs. @module */
import * as Esbuild from 'esbuild'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs/promises'
import * as Os from 'node:os'
import * as Zlib from 'node:zlib'
import { bench, describe } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const measurements: object[] = []

for (const output of ['react', 'html'] as const) {
  for (const binding of [false, true]) {
    const source = `import {Config,cx} from 'zyzz';const {css}=Config.create({output:'${output}'});const a=css({padding:'8px'});const b=css({paddingLeft:'3px'});export function apply(){${binding ? 'const props=a();const alias=props;return cx(alias,b())' : 'return cx(a(),b())'}}`
    const options = { moduleId: 'bindings.ts', source }
    const compiled = Transform.compile(options)
    const bundled = await Esbuild.build({
      alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
      bundle: true,
      format: 'esm',
      minify: true,
      stdin: {
        contents: compiled.code,
        loader: 'ts',
        resolveDir: process.cwd(),
      },
      write: false,
    })
    const code = bundled.outputFiles![0]!.text
    const module = (await import(
      `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
    )) as { apply: () => unknown }
    const name = `${output} ${binding ? 'bound' : 'direct'}`
    measurements.push({
      css: Buffer.byteLength(compiled.css),
      cssGzip: Zlib.gzipSync(compiled.css).length,
      javascript: Buffer.byteLength(code),
      javascriptGzip: Zlib.gzipSync(code).length,
      name,
      sourceSha256: Crypto.createHash('sha256').update(source).digest('hex'),
    })
    describe(`cx / ${name}`, () => {
      bench(
        'compile',
        () => {
          Transform.compile(options)
        },
        { time: 250, warmupTime: 100 },
      )
      bench(
        'apply',
        () => {
          module.apply()
        },
        { time: 250, warmupTime: 100 },
      )
    })
  }
}

await Fs.mkdir('bench/results', { recursive: true })
await Fs.writeFile(
  'bench/results/composition-bindings-metadata.json',
  JSON.stringify(
    {
      architecture: process.arch,
      cache:
        'module initialization excluded; in-process warm compilation and application',
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
