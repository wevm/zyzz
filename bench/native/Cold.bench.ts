/** Measures fresh process startup and the first native Babel transformation together. @module */
import * as ChildProcess from 'node:child_process'
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { bench, describe } from 'vite-plus/test'
import * as Corpus from './Corpus.js'

const worker = Path.resolve('bench/results/native/Worker.mjs')
for (const platform of ['ios', 'android'] as const)
  for (const count of Corpus.counts)
    for (const kind of Corpus.kinds)
      describe(`native cold process ${platform} / ${kind} / ${count}`, () => {
        for (const library of Corpus.libraries)
          bench(
            library,
            () =>
              new Promise<void>((resolve, reject) => {
                ChildProcess.execFile(
                  process.execPath,
                  [worker, library, kind, String(count), platform],
                  { timeout: 60_000 },
                  (error, stdout) => {
                    if (error) reject(error)
                    else if (
                      Number(stdout) <= 0 ||
                      !Number.isFinite(Number(stdout))
                    )
                      reject(new Error('Invalid cold output'))
                    else resolve()
                  },
                )
              }),
            {
              iterations: 10,
              time: 1000,
              warmupIterations: 1,
              warmupTime: 0,
              setup: async () => {
                await Fs.mkdir(Path.dirname(worker), { recursive: true })
                await Esbuild.build({
                  entryPoints: ['bench/native/Worker.ts'],
                  outfile: worker,
                  bundle: true,
                  packages: 'external',
                  platform: 'node',
                  format: 'esm',
                })
              },
            },
          )
      })
