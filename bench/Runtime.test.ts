/**
 * Checks compiled runtime applications against browser styles and caller inputs.
 * @module
 */
import * as Runtime from './Runtime.js'
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Zlib from 'node:zlib'
import { chromium } from 'playwright'
import * as React from 'react'
import * as ReactDom from 'react-dom/server'
import { describe, expect, test } from 'vite-plus/test'

describe('create', () => {
  for (const kind of Runtime.cases)
    for (const library of Runtime.librariesFor(kind))
      test(`${library} / ${kind} preserves styling through production compilation`, async () => {
        const options = { count: 10, kind, library }
        const output = await Runtime.create(options)

        const input = {
          alpha: 0.5,
          width: '25px',
          className: 'external',
          style: { color: '#123456', paddingLeft: '2px' },
        }

        const before = JSON.stringify(input)

        for (let index = 0; index < options.count; index++) {
          const props = output.apply(index, input)

          expect(
            (props === output.apply(index, input)) === (kind === 'cached'),
          ).toMatchInlineSnapshot(`true`)
          expect(typeof props.className).toMatchInlineSnapshot(`"string"`)

          if (kind === 'overrides') {
            expect(props.className.endsWith(' external')).toMatchInlineSnapshot(
              `true`,
            )
            expect(props.style).toMatchInlineSnapshot(`
              {
                "color": "#123456",
                "paddingLeft": "2px",
              }
            `)
          }
        }

        expect(JSON.stringify(input) === before).toMatchInlineSnapshot(`true`)

        await Runtime.verify(output, options)
      }, 30_000)
})

describe('browser', () => {
  describe('browser runtime', () => {
    test.runIf(process.env.BENCH_RUNTIME === '1')(
      'measures equivalent production applications',
      async () => {
        const directory = process.env.BENCH_RUNTIME_OUTPUT ?? 'bench/results'
        const browser = await chromium.launch()
        const bundles = new Map<string, Runtime.Bundle>()
        const groups = []

        try {
          for (const count of [10, 100])
            for (const kind of Runtime.cases)
              for (const repeat of [1, 2]) {
                const benchmarks = []
                const libraries =
                  repeat === 1
                    ? Runtime.librariesFor(kind)
                    : [...Runtime.librariesFor(kind)].reverse()

                for (const library of libraries) {
                  const key = `${count}/${kind}/${library}`
                  let output = bundles.get(key)

                  if (!output) {
                    output = await Runtime.create({ count, kind, library })
                    await Runtime.verify(output, { count, kind, library })
                    bundles.set(key, output)

                    const sizesDirectory = Path.join(
                      directory,
                      'runtime',
                      String(count),
                      kind,
                    )

                    await Fs.mkdir(sizesDirectory, { recursive: true })

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
                      Path.join(sizesDirectory, `${library}.json`),
                      JSON.stringify(
                        {
                          attributes,
                          classNames,
                          css,
                          helperArtifact,
                          javascript,
                          markup,
                          hydrated: {
                            raw: css.raw + javascript.raw + markup.raw,
                            gzip: css.gzip + javascript.gzip + markup.gzip,
                            brotli:
                              css.brotli + javascript.brotli + markup.brotli,
                          },
                          library,
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
                  }

                  const page = await browser.newPage()

                  try {
                    await page.addScriptTag({ content: output.javascript })

                    const timing = await page.evaluate(
                      ({ count, overrides }) => {
                        const { apply } = (
                          window as unknown as {
                            fixture: Pick<Runtime.Bundle, 'apply'>
                          }
                        ).fixture

                        const results: Runtime.Props[] = []
                        let index = 0

                        const batch = (iterations: number) => {
                          const start = performance.now()

                          for (
                            let iteration = 0;
                            iteration < iterations;
                            iteration++
                          ) {
                            index = (index + 1) % count
                            results[index] = apply(index, overrides[index % 2]!)
                          }

                          return performance.now() - start
                        }

                        let iterations = 256

                        // Amortize timer resolution. Compilation and protocol calls are excluded.
                        while (batch(iterations) < 2 && iterations < 1_048_576)
                          iterations *= 2

                        const warmup = performance.now()

                        while (performance.now() - warmup < 200)
                          batch(iterations)

                        const samples = Array.from(
                          { length: 100 },
                          () => batch(iterations) / iterations,
                        )
                        const mean =
                          samples.reduce((total, value) => total + value, 0) /
                          samples.length

                        const variance =
                          samples.reduce(
                            (total, value) => total + (value - mean) ** 2,
                            0,
                          ) /
                          (samples.length - 1)

                        // Two-sided 95% Student t interval for 99 degrees of freedom.
                        const rme =
                          (100 * 1.984 * Math.sqrt(variance / samples.length)) /
                          mean
                        if (
                          !results.every((props) => props.className.length > 0)
                        )
                          throw new Error('No observable runtime props.')

                        return {
                          iterations,
                          mean,
                          rme,
                          sampleCount: samples.length,
                          samples,
                        }
                      },
                      { count, overrides: Runtime.overrides },
                    )

                    expect(
                      Number.isFinite(timing.mean) && timing.mean > 0,
                    ).toMatchInlineSnapshot(`true`)

                    benchmarks.push({ ...timing, name: library })
                    console.log(
                      `runtime ${count}/${kind}/${repeat} ${library}: ${(timing.mean * 1e6).toFixed(1)} ns ±${timing.rme.toFixed(1)}%`,
                    )
                  } finally {
                    await page.close()
                  }
                }

                groups.push({
                  benchmarks,
                  fullName: `runtime comparison / ${count} styles / ${kind} / repeat ${repeat}`,
                })
                await Fs.mkdir(directory, { recursive: true })
                await Fs.writeFile(
                  Path.join(directory, 'browser-timings.json'),
                  JSON.stringify(
                    {
                      browser: browser.version(),
                      files: [{ groups }],
                      host: 'Chromium',
                      measurement:
                        'milliseconds per application; batched inside page.evaluate',
                    },
                    null,
                    2,
                  ),
                )
              }
        } finally {
          await browser.close()
        }
      },
      300_000,
    )
  })
})
