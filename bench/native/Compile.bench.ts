/** Measures warm and edited-module transforms with independently prepared inputs. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Zlib from 'node:zlib'
import { bench, describe } from 'vite-plus/test'
import * as Compile from './Compile.js'
import * as Corpus from './Corpus.js'

for (const platform of ['ios', 'android'] as const)
  for (const count of Corpus.counts)
    for (const kind of Corpus.kinds)
      for (const edited of [false, true])
        describe(`native ${platform} / ${kind} / ${count} / ${edited ? 'edited module' : 'warm module'}`, () => {
          for (const library of Corpus.libraries) {
            const source = Corpus.source(library, { count, kind }, edited)
            bench(
              library,
              () => {
                Compile.compile(
                  library,
                  { count, kind },
                  platform,
                  edited,
                  source,
                )
              },
              {
                iterations: 20,
                time: 1000,
                warmupIterations: 3,
                warmupTime: 300,
                setup: async () => {
                  const result = Compile.compile(
                    library,
                    { count, kind },
                    platform,
                    edited,
                    source,
                  )
                  if (
                    !result.code ||
                    (library === 'zyzz' &&
                      !result.code.includes('__zyzzNativeContext.create'))
                  )
                    throw new Error(`Uncompiled ${library} fixture`)
                  const directory = Path.resolve(
                    'bench/results/native/compile',
                    platform,
                    `${kind}-${count}`,
                    edited ? 'edited' : 'warm',
                  )
                  await Fs.mkdir(directory, { recursive: true })
                  await Fs.writeFile(
                    Path.join(directory, `${library}.js`),
                    result.code,
                  )
                  await Fs.writeFile(
                    Path.join(directory, `${library}.json`),
                    JSON.stringify(
                      {
                        javascript: {
                          raw: Buffer.byteLength(result.code),
                          gzip: Zlib.gzipSync(result.code).byteLength,
                          brotli: Zlib.brotliCompressSync(result.code)
                            .byteLength,
                        },
                        sourceMap: Buffer.byteLength(
                          JSON.stringify(result.map),
                        ),
                        scope:
                          'Transformed module only, excludes shared runtime and native binary',
                      },
                      null,
                      2,
                    ),
                  )
                  await Fs.writeFile(
                    Path.join(directory, `${library}.map`),
                    JSON.stringify(result.map),
                  )
                },
              },
            )
          }
        })
