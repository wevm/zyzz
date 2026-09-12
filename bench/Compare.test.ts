/**
 * Exercises report generation and action inputs through the benchmark CLI.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { describe, expect, test } from 'vite-plus/test'

const run = Util.promisify(ChildProcess.execFile)

describe('benchmark report', () => {
  test('unavailable timings retain reports and valid action measurements', async () => {
    const directory = await Fs.mkdtemp(Path.resolve('.fixture-report-'))
    const baseline = Path.join(directory, 'baseline')
    const candidate = Path.join(directory, 'candidate')
    const output = Path.join(directory, 'output')

    try {
      for (const root of [baseline, candidate]) {
        await Fs.mkdir(root)
        await Fs.writeFile(Path.join(root, 'commit.txt'), 'abcdef0123456789')
        await Fs.writeFile(
          Path.join(root, 'sizes.json'),
          JSON.stringify({ css: { gzip: 10 } }),
        )
        await Fs.writeFile(
          Path.join(root, 'timings.json'),
          JSON.stringify({
            files: [
              {
                groups: [
                  {
                    fullName: 'src/node/Host.bench.ts > file host / 100 styles',
                    benchmarks: [
                      {
                        name: 'unchanged rebuild',
                        mean: 1,
                        rme: 2,
                        sampleCount: 3,
                      },
                      // Vite Plus emitted this incomplete shape in a real watch benchmark run.
                      root === candidate
                        ? { name: 'watch edit', rank: 1, rme: 0, samples: [] }
                        : {
                            name: 'watch edit',
                            mean: 5,
                            rme: 1,
                            sampleCount: 3,
                          },
                    ],
                  },
                ],
              },
            ],
          }),
        )
      }

      const result = await run(
        process.execPath,
        [Path.resolve('bench/Compare.ts'), candidate, baseline, output],
        {
          env: {
            ...process.env,
            BENCH_BASELINE_MODE: 'same-runner',
            BENCH_SIZE_THRESHOLD: '105',
            BENCH_TIME_THRESHOLD: '110',
            GITHUB_REPOSITORY: 'wevm/zyzz',
          },
        },
      )

      expect(result.stdout).toMatchInlineSnapshot(`
        "## Compared with baseline

        Baseline: [abcdef0](https://github.com/wevm/zyzz/commit/abcdef0123456789)

        🟢 Improved · 🟡 Within tolerance / unchanged · 🔴 Regression above threshold

        Timing changes above 10% are advisory. Gzip growth above 5% fails PR/manual checks. Zyzz measurements only; baseline and candidate ran sequentially on the same runner. Reported timing errors are informational.

        | Benchmark | Baseline | PR / current | Change |
        | --- | ---: | ---: | ---: |
        | file host / 100 styles / unchanged rebuild | 1 ms ±2.0% | 1 ms ±2.0% | 🟡 0.0% |
        | sizes / CSS gzip | 10 B | 10 B | 🟡 0 B · 0.0% |
        | file host / 100 styles / watch edit | 5 ms ±1.0% | Unavailable | No timing samples |

        "
      `)
      expect(
        JSON.parse(await Fs.readFile(Path.join(output, 'time.json'), 'utf8')),
      ).toMatchInlineSnapshot(`
        [
          {
            "name": "src/node/Host.bench.ts > file host / 100 styles / unchanged rebuild",
            "range": "± 0.02",
            "unit": "ms",
            "value": 1,
          },
        ]
      `)
      expect(
        JSON.parse(await Fs.readFile(Path.join(output, 'size.json'), 'utf8')),
      ).toMatchInlineSnapshot(`
        [
          {
            "name": "sizes / CSS gzip",
            "range": "± 0",
            "unit": "B",
            "value": 10,
          },
        ]
      `)
    } finally {
      await Fs.rm(directory, { recursive: true, force: true })
    }
  })
})
