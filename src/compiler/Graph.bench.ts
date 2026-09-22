/**
 * Measures linked source compilation using the integration module graph.
 * @module
 */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Zlib from 'node:zlib'
import { bench, describe } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import * as Universal from '../../test/fixtures/UniversalLibrary.js'
import * as Compilation from '../../bench/Compilation.js'
import * as ConfigFixture from '../../test/fixtures/ConfigGraph.js'
import * as Fixture from '../../test/fixtures/ThemeGraph.js'

for (const count of [10, 100]) {
  const modules = {
    ...Fixture.modules,
    'pkg/card.ts': `import { style } from './index.js'; ${Array.from({ length: count }, (_, index) => `export const props${index} = style({color:'brand',padding:'${index}px !custom'})();`).join('\n')}`,
  }

  describe(`theme graph / ${count} styles`, () => {
    bench(
      'link + extract + emit + rewrite + maps',
      () => {
        Graph.compile({
          composition: 'independent',
          cssOutput: 'grouped',
          modules,
        })
      },
      {
        iterations: 30,
        time: 1000,
        warmupIterations: 10,
        warmupTime: 500,
        setup: async () => {
          const output = Graph.compile({
            composition: 'independent',
            cssOutput: 'grouped',
            modules,
          })
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

for (const count of [10, 100]) {
  for (const edit of ['consumer', 'theme', 'unchanged'] as const) {
    const original = Fixture.project(count)
    const changed = { ...original }

    if (edit === 'consumer')
      changed['pkg/card0.ts'] = original['pkg/card0.ts']!.replace('0px', '20px')
    else if (edit === 'theme')
      changed['pkg/theme.ts'] = original['pkg/theme.ts']!.replace(
        "'#06c'",
        "'#f00'",
      )

    const snapshots = [original, changed]

    describe(`incremental graph / ${count} consumers / ${edit}`, () => {
      for (const mode of ['full', 'incremental']) {
        let compiler: Graph.create.ReturnType
        let iteration = 0

        bench(
          mode,
          () => {
            const modules = snapshots[++iteration % 2]!

            if (mode === 'full')
              Graph.compile({
                composition: 'independent',
                cssOutput: 'grouped',
                modules,
              })
            else
              compiler.compile({
                composition: 'independent',
                cssOutput: 'grouped',
                modules,
              })
          },
          {
            iterations: 30,
            setup: () => {
              compiler = Graph.create()
              compiler.compile({
                composition: 'independent',
                cssOutput: 'grouped',
                modules: original,
              })

              // Both lanes must deliver the same complete artifacts after an edit.
              const expected = Graph.compile({
                composition: 'independent',
                cssOutput: 'grouped',
                modules: changed,
              })
              const actual = compiler.compile({
                composition: 'independent',
                cssOutput: 'grouped',
                modules: changed,
              })
              if (JSON.stringify(actual) !== JSON.stringify(expected))
                throw new Error(
                  'Incremental graph artifacts differ from full compilation.',
                )

              compiler.compile({
                composition: 'independent',
                cssOutput: 'grouped',
                modules: original,
              })
              iteration = 0
            },
            time: 1000,
            warmupIterations: 10,
            warmupTime: 500,
          },
        )
      }
    })
  }
}

for (const count of [10, 100]) {
  const library = Graph.compile({
    composition: 'independent',
    cssOutput: 'grouped',
    modules: Fixture.modules,
  })
  const contracts = { 'library/index.js': library.contracts['pkg/index.ts']! }
  const modules = {
    'app/card.ts': `import { style } from '@acme/theme'; ${Array.from({ length: count }, (_, index) => `export const props${index} = style({color:'brand',padding:'${index}px !custom'})();`).join('\n')}`,
  }

  describe(`packed theme graph / ${count} styles`, () => {
    bench(
      'read contracts + extract + emit + rewrite + maps',
      () => {
        Graph.compile({
          composition: 'independent',
          cssOutput: 'grouped',
          contracts,
          imports: { 'app/card.ts': { '@acme/theme': 'library/index.js' } },
          modules,
        })
      },
      { iterations: 30, time: 1000, warmupIterations: 10, warmupTime: 500 },
    )
  })
}

for (const count of [10, 100]) {
  const modules = {
    ...ConfigFixture.modules,
    'pkg/card.ts': `import { design as zyzz } from './index.js'; ${Array.from({ length: count }, (_, index) => `export const props${index} = zyzz.style({color:'brand',padding:'${index}px !custom'})();`).join('\n')}`,
  }

  describe(`configuration graph / ${count} styles`, () => {
    bench(
      'normalize + link + extract + emit + rewrite + maps',
      () => {
        Graph.compile({
          composition: 'independent',
          cssOutput: 'grouped',
          modules,
        })
      },
      { iterations: 30, time: 1000, warmupIterations: 10, warmupTime: 500 },
    )
  })
}

// Native workloads use the same shared source graph as packed consumer acceptance.
describe('native graph', () => {
  const native = { colorScheme: 'dark', platform: 'android' } as const
  const compiler = Graph.create()
  const library = Graph.compile({ modules: Universal.modules })
  const packed = {
    contracts: { 'library.js': library.contracts['index.ts']! },
    imports: { 'app.ts': { library: 'library.js' } },
    modules: {
      'app.ts': `import {button} from 'library';export const props=button({size:'large',active:true});`,
    },
    native,
  }
  compiler.compile({ modules: Universal.modules, native })

  bench('cold source graph', () => {
    Graph.compile({ modules: Universal.modules, native })
  })
  bench('unchanged source graph', () => {
    compiler.compile({ modules: Universal.modules, native })
  })
  bench('packed consumer', () => {
    Graph.compile(packed)
  })
})
