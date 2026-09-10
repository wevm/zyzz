/**
 * Collects client application timings inside Chromium, outside protocol overhead.
 * @module
 */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Zlib from 'node:zlib'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import * as Runtime from './Runtime.js'

describe('browser runtime', () => {
  test.runIf(process.env.BENCH_RUNTIME === '1')(
    'measures equivalent production applications',
    async () => {
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
                  ? Runtime.libraries
                  : [...Runtime.libraries].reverse()
              for (const library of libraries) {
                const key = `${count}/${kind}/${library}`
                let output = bundles.get(key)
                if (!output) {
                  output = await Runtime.create({ count, kind, library })
                  await Runtime.verify(output, { count, kind, library })
                  bundles.set(key, output)
                  const directory = Path.join(
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
                  const css = measure(output.css)
                  const javascript = measure(output.javascript)
                  await Fs.writeFile(
                    Path.join(directory, `${library}.json`),
                    JSON.stringify(
                      {
                        css,
                        javascript,
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
                      // Amortize timer resolution; compilation and protocol calls are excluded.
                      while (batch(iterations) < 2 && iterations < 1_048_576)
                        iterations *= 2
                      const warmup = performance.now()
                      while (performance.now() - warmup < 200) batch(iterations)
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
                      if (!results.every((props) => props.className.length > 0))
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
              await Fs.mkdir('bench/results', { recursive: true })
              await Fs.writeFile(
                'bench/results/browser-timings.json',
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
    180_000,
  )
})
