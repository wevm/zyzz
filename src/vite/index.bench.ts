/**
 * Measures Vite builds, delivered assets, and development module transforms.
 * @module
 */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Zlib from 'node:zlib'
import * as Vite from 'vite'
import { bench, describe } from 'vite-plus/test'
import { zyzz } from 'zyzz/vite'
import * as PlainPackage from '../../test/fixtures/PlainPackage.js'
import * as Fixture from '../../test/fixtures/Vite.js'

for (const count of [10, 100]) {
  describe(`vite build / ${count} consumers`, () => {
    let root: string
    let config: Vite.InlineConfig

    bench(
      'production build',
      async () => {
        await Vite.build(config)
      },
      {
        iterations: 30,
        setup: async () => {
          root = await Fs.mkdtemp(Path.resolve('.fixture-vite-bench-'))

          for (const [name, content] of Object.entries(Fixture.files))
            await Fs.writeFile(Path.join(root, name), content)

          for (let index = 0; index < count; index++)
            await Fs.writeFile(
              Path.join(root, `card${index}.ts`),
              Fixture.files['card.ts'].replace('8px', `${index}px`),
            )

          await Fs.writeFile(
            Path.join(root, 'main.ts'),
            [
              `import { vars } from './config'; document.body.className = vars({set:'mint'}).className;`,
              ...Array.from(
                { length: count },
                (_, index) =>
                  `import { props as props${index} } from './card${index}';`,
              ),
              `for (const props of [${Array.from({ length: count }, (_, index) => `props${index}`).join(',')}]) { const card = document.createElement('div'); card.className = props.className; document.body.append(card); }`,
            ].join('\n'),
          )
          config = {
            build: { write: false },
            configFile: false,
            logLevel: 'silent',
            plugins: [zyzz()],
            resolve: {
              alias: {
                '@theme': Path.join(root, 'theme.ts'),
                'zyzz/runtime': Path.resolve('src/runtime/index.ts'),
              },
            },
            root,
          }

          const result = await Vite.build(config)
          if (Array.isArray(result) || !('output' in result))
            throw new Error('Expected one Vite build')

          const css = result.output
            .flatMap((file) =>
              file.type === 'asset' && file.fileName.endsWith('.css')
                ? [
                    typeof file.source === 'string'
                      ? file.source
                      : new TextDecoder().decode(file.source),
                  ]
                : [],
            )
            .join('\n')

          const javascript = result.output
            .filter((file) => file.type === 'chunk')
            .map((file) => file.code)
            .join('\n')

          const measure = (text: string) => ({
            brotli: Zlib.brotliCompressSync(text).length,
            gzip: Zlib.gzipSync(text).length,
            raw: Buffer.byteLength(text),
          })

          const cssSize = measure(css)
          const jsSize = measure(javascript)

          await Fs.mkdir('bench/results/vite', { recursive: true })
          await Fs.writeFile(
            `bench/results/vite/${count}.json`,
            JSON.stringify({
              count,
              css: cssSize,
              javascript: jsSize,
              total: {
                brotli: cssSize.brotli + jsSize.brotli,
                gzip: cssSize.gzip + jsSize.gzip,
                raw: cssSize.raw + jsSize.raw,
              },
            }),
          )
        },
        teardown: async () => {
          await Fs.rm(root, { recursive: true, force: true })
        },
        time: 1000,
        warmupIterations: 10,
        warmupTime: 500,
      },
    )
  })
}

for (const count of [10, 100]) {
  describe(`vite dev / ${count} package consumers`, () => {
    let root: string
    let config: Vite.InlineConfig

    bench(
      'cold module transforms',
      async () => {
        const server = await Vite.createServer(config)

        try {
          const environment = server.environments.client!

          // Each module transform and stylesheet load compiles every consumer.
          for (let index = 0; index < count; index++) {
            const result = await environment.transformRequest(
              `/card${index}.ts`,
            )

            for (const [, id] of result!.code.matchAll(
              /import\s*"\/@id\/__x00__(zyzz:[^"]+)"/g,
            ))
              await environment.transformRequest(`\0${id}`)
          }
        } finally {
          await server.close()
        }
      },
      {
        iterations: 5,
        setup: async () => {
          root = await Fs.mkdtemp(Path.resolve('.fixture-vite-bench-'))

          // The package ships no sidecar, so each read derives its contract.
          await PlainPackage.install(root)
          await Fs.symlink(
            process.cwd(),
            Path.join(root, 'node_modules/zyzz'),
            'dir',
          )

          for (let index = 0; index < count; index++)
            await Fs.writeFile(
              Path.join(root, `card${index}.ts`),
              `import { style } from '@acme/tokens'; export const props = style({ opacity: ${index / count}, padding: '16' })();`,
            )

          config = {
            configFile: false,
            logLevel: 'silent',
            optimizeDeps: { noDiscovery: true },
            plugins: [zyzz()],
            root,
          }
        },
        teardown: async () => {
          await Fs.rm(root, { recursive: true, force: true })
        },
        time: 0,
        warmupIterations: 1,
        warmupTime: 0,
      },
    )
  })
}
