/**
 * Measures production props application after compilation and browser verification.
 * @module
 */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Zlib from 'node:zlib'
import * as React from 'react'
import * as ReactDom from 'react-dom/server'
import { bench, describe } from 'vite-plus/test'
import * as Runtime from './Runtime.js'

const bundles = new Map<string, Runtime.Bundle>()
const results: Runtime.Props[] = []

for (const count of [10, 100])
  for (const kind of Runtime.cases)
    for (const repeat of [1, 2])
      describe.runIf(process.env.BENCH_MICRO === '1')(
        `node runtime comparison / ${count} styles / ${kind} / repeat ${repeat}`,
        () => {
          // Reverse adapter order to expose systematic warmup/order effects.
          const libraries =
            repeat === 1
              ? Runtime.librariesFor(kind)
              : [...Runtime.librariesFor(kind)].reverse()

          for (const library of libraries) {
            let apply: Runtime.Bundle['apply']
            let index = 0

            bench(
              library,
              () => {
                index = (index + 1) % count
                results[index] = apply(index, Runtime.overrides[index % 2]!)
              },
              {
                iterations: 100,
                time: 500,
                warmupIterations: 100,
                warmupTime: 250,
                setup: async () => {
                  const key = `${count}/${kind}/${library}`
                  let output = bundles.get(key)

                  if (!output) {
                    output = await Runtime.create({ count, kind, library })
                    await Runtime.verify(output, { count, kind, library })
                    bundles.set(key, output)

                    const directory = Path.resolve(
                      'bench/results/runtime',
                      String(count),
                      kind,
                    )

                    await Fs.mkdir(directory, { recursive: true })

                    const measure = (value: string) => ({
                      brotli: Zlib.brotliCompressSync(value).byteLength,
                      gzip: Zlib.gzipSync(value).byteLength,
                      raw: Buffer.byteLength(value),
                    })

                    const helperExports =
                      kind === 'variants'
                        ? 'Composition, Recipe'
                        : kind === 'dynamic'
                          ? 'Dynamic'
                          : kind === 'callable' || kind === 'overrides'
                            ? 'Props'
                            : ''
                    const helperBundle =
                      library === 'zyzz' && helperExports
                        ? await Esbuild.build({
                            alias: {
                              'zyzz/runtime': Path.resolve(
                                'src/runtime/index.ts',
                              ),
                            },
                            bundle: true,
                            format: 'esm',
                            minify: true,
                            stdin: {
                              contents: `export {${helperExports}} from 'zyzz/runtime'`,
                              loader: 'ts',
                              resolveDir: process.cwd(),
                            },
                            write: false,
                          })
                        : undefined
                    const helperArtifact = helperBundle
                      ? measure(helperBundle.outputFiles[0]!.text)
                      : null
                    const css = measure(output.css)
                    const javascript = measure(output.javascript)
                    const props = Array.from({ length: count }, (_, index) =>
                      output!.apply(index, Runtime.overrides[index % 2]!),
                    )
                    const attributes = measure(
                      props
                        .map((value) =>
                          ReactDom.renderToStaticMarkup(
                            React.createElement('article', value),
                          ),
                        )
                        .map((html) =>
                          html.slice('<article'.length, html.indexOf('>')),
                        )
                        .join(''),
                    )
                    const classNames = measure(
                      props.map((value) => value.className).join(' '),
                    )
                    const markup = measure(
                      props
                        .map((value) =>
                          ReactDom.renderToStaticMarkup(
                            React.createElement('article', value, 'Card'),
                          ),
                        )
                        .join(''),
                    )

                    await Fs.writeFile(
                      Path.join(directory, `${library}.json`),
                      JSON.stringify(
                        {
                          attributes,
                          classNames,
                          count,
                          css,
                          helperArtifact,
                          javascript,
                          kind,
                          library,
                          markup,
                          hydrated: {
                            raw: css.raw + javascript.raw + markup.raw,
                            gzip: css.gzip + javascript.gzip + markup.gzip,
                            brotli:
                              css.brotli + javascript.brotli + markup.brotli,
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
                      Path.join(directory, `${library}.css`),
                      output.css,
                    )
                    await Fs.writeFile(
                      Path.join(directory, `${library}.js`),
                      output.javascript,
                    )
                  }

                  apply = output.apply
                },
                teardown: () => {
                  // Retaining and reading returned props prevents dead-result benchmarks.
                  if (!results.some((props) => props.className.length > 0))
                    throw new Error(
                      'Runtime benchmark produced no observable props.',
                    )

                  results.length = 0
                },
              },
            )
          }
        },
      )
