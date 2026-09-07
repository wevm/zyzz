import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { bench, describe } from 'vite-plus/test'
import { Host } from 'zyzz/node'

const run = Util.promisify(ChildProcess.execFile)
const source = `import { css } from 'zyzz'; ${Array.from({ length: 100 }, (_, index) => `export const card${index} = css({ padding: '${index}px' });`).join('\n')}`

for (const mode of [
  'cold process rebuild',
  'unchanged rebuild',
  'watch edit',
]) {
  describe('file host / 100 styles', () => {
    let directory: string
    let host: Host.Runtime | undefined
    let resolve: (() => void) | undefined
    let version = 0

    bench(
      mode,
      async () => {
        if (mode === 'cold process rebuild') {
          await run(process.execPath, [Path.join(directory, 'driver.mjs')])
        } else if (mode === 'unchanged rebuild') {
          await host!.build()
        } else {
          const completed = new Promise<void>((done) => {
            resolve = done
          })
          version++
          await Fs.writeFile(
            Path.join(directory, 'src/cards.ts'),
            source.replace('0px', `${version}px`),
          )
          await completed
        }
      },
      {
        iterations: 3,
        setup: async () => {
          directory = await Fs.mkdtemp(Path.resolve('.fixture-host-bench-'))
          const root = Path.join(directory, 'src')
          await Fs.mkdir(root)
          await Fs.writeFile(Path.join(root, 'cards.ts'), source)
          const options = {
            outDir: Path.join(directory, 'output'),
            packageId: 'benchmark',
            root,
          }

          if (mode === 'cold process rebuild') {
            const output = await Esbuild.build({
              bundle: true,
              conditions: ['src'],
              format: 'esm',
              packages: 'external',
              platform: 'node',
              stdin: {
                contents: `import { Host } from './src/node/index.ts'; const host = await Host.create(${JSON.stringify(options)}); try { await host.build() } finally { await host.close() }`,
                resolveDir: process.cwd(),
              },
              write: false,
            })
            // Generated process driver, not repository source.
            await Fs.writeFile(
              Path.join(directory, 'driver.mjs'),
              output.outputFiles[0]!.text,
            )
            await run(process.execPath, [Path.join(directory, 'driver.mjs')])
          } else {
            host = await Host.create(options)
            if (mode === 'watch edit') {
              const initial = new Promise<void>((done) => {
                resolve = done
              })
              host.watch({
                onResult(event) {
                  if ('error' in event) throw event.error
                  if (event.result.changed.includes('cards.ts.css')) {
                    resolve?.()
                    resolve = undefined
                  }
                },
              })
              await initial
            } else await host.build()
          }
        },
        teardown: async () => {
          // Tinybench does not await teardown before the next setup.
          const previousDirectory = directory
          const previousHost = host
          await previousHost?.close()
          await Fs.rm(previousDirectory, { force: true, recursive: true })
        },
        time: 100,
        warmupIterations: 1,
        warmupTime: 50,
      },
    )
  })
}
