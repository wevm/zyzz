/**
 * Renders the pull request benchmark comment from framework measurements that the gate records.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { describe, expect, test } from 'vite-plus/test'

const run = Util.promisify(ChildProcess.execFile)

describe('benchmark comment', () => {
  const url = 'https://github.com/wevm/zyzz/actions/runs/1'

  /** Writes gate inputs where Zyzz builds fastest and has the smallest CSS and total. */
  async function results(
    directory: string,
    options: { readonly missing?: string | undefined } = {},
  ) {
    const competitors = [
      'panda',
      'stylex',
      'tailwind',
      'tamagui',
      'vanilla-extract',
    ]
    const workloads = [
      ...[
        'small',
        'repeated',
        'unique',
        'partial',
        'palette',
        'independent',
        'sparse',
        'components',
      ].map((name) => ({
        directory: name,
        group: `fresh compilation / ${name}`,
        lanes: ['zyzz'],
      })),
      {
        directory: 'app',
        group: 'fresh compilation / app',
        lanes: ['zyzz-source'],
      },
      ...[10, 100].map((count) => ({
        directory: `theme-comparison/${count}`,
        group: `theme comparison / ${count} styles`,
        lanes: ['zyzz', 'zyzz-tokens'],
      })),
    ]
    const groups = []

    for (const [index, workload] of workloads.entries()) {
      const benchmarks = []

      await Fs.mkdir(Path.join(directory, workload.directory), {
        recursive: true,
      })

      for (const [rank, library] of [
        ...workload.lanes,
        ...competitors,
      ].entries()) {
        if (library === options.missing && workload.directory === 'app')
          continue

        // vanilla-extract ships less JavaScript, which only the JS table reports.
        const css = 100 * (index + 1) + 10 * rank
        const javascript = library === 'vanilla-extract' ? 40 : 50 + rank

        benchmarks.push({
          mean: index + 1 + rank / 4,
          name: library,
          rme: 1,
          sampleCount: 10,
        })
        await Fs.writeFile(
          Path.join(directory, workload.directory, `${library}.json`),
          JSON.stringify({
            css: { gzip: css },
            javascript: { gzip: javascript },
            library,
            total: { gzip: css + javascript },
          }),
        )
      }

      groups.push({
        benchmarks,
        fullName: `bench/example.bench.ts > ${workload.group}`,
      })
    }

    await Fs.writeFile(
      Path.join(directory, 'timings.json'),
      JSON.stringify({ files: [{ groups }] }),
    )
  }

  /** Runs the gate, then the comment, through their command-line entrypoints. */
  async function comment(
    directory: string,
    options: { readonly gate: boolean },
  ) {
    if (options.gate)
      await run(process.execPath, [
        Path.resolve('bench/Check.ts'),
        directory,
      ]).catch((error: { code: number }) => error)

    const { stdout } = await run(process.execPath, [
      Path.resolve('bench/Comment.ts'),
      directory,
      url,
    ])

    return stdout
  }

  test('measured', async () => {
    const directory = await Fs.mkdtemp(Path.resolve('.fixture-comment-'))

    try {
      await results(directory)

      const output = await comment(directory, { gate: true })

      expect(output).toMatchInlineSnapshot(`
        "# Benchmark Report

        🟢 Zyzz passes the framework gate in all 11 workloads.

        Every workload compiles from fresh compiler state, including Lightning CSS minification and esbuild client bundling. Lower is better, and bold marks the best result in each row.

        ## Compile Time

        Mean milliseconds per compilation.

        | Workload | Zyzz | Panda CSS | StyleX | Tailwind | Tamagui | vanilla-extract | Zyzz vs. Best Competitor |
        | :--- | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
        | 3 Components | **1.00** | 1.25 | 1.50 | 1.75 | 2.00 | 2.25 | 🟢 1.25× faster than Panda CSS |
        | 1,000 Components: Repeated Styles | **2.00** | 2.25 | 2.50 | 2.75 | 3.00 | 3.25 | 🟢 1.13× faster than Panda CSS |
        | 1,000 Components: Unique Padding | **3.00** | 3.25 | 3.50 | 3.75 | 4.00 | 4.25 | 🟢 1.08× faster than Panda CSS |
        | 100 Components: Partial Sharing | **4.00** | 4.25 | 4.50 | 4.75 | 5.00 | 5.25 | 🟢 1.06× faster than Panda CSS |
        | 100 Components: Reused Palette | **5.00** | 5.25 | 5.50 | 5.75 | 6.00 | 6.25 | 🟢 1.05× faster than Panda CSS |
        | 100 Components: Independent Values | **6.00** | 6.25 | 6.50 | 6.75 | 7.00 | 7.25 | 🟢 1.04× faster than Panda CSS |
        | 100 Components: Sparse Properties | **7.00** | 7.25 | 7.50 | 7.75 | 8.00 | 8.25 | 🟢 1.04× faster than Panda CSS |
        | 60 Components: Mixed Shapes | **8.00** | 8.25 | 8.50 | 8.75 | 9.00 | 9.25 | 🟢 1.03× faster than Panda CSS |
        | 300 Components: Application Scale | **9.00** | 9.25 | 9.50 | 9.75 | 10.00 | 10.25 | 🟢 1.03× faster than Panda CSS |
        | Themes: 10 Components | **10.25** | 10.50 | 10.75 | 11.00 | 11.25 | 11.50 | 🟢 1.02× faster than Panda CSS |
        | Themes: 100 Components | **11.25** | 11.50 | 11.75 | 12.00 | 12.25 | 12.50 | 🟢 1.02× faster than Panda CSS |

        ## CSS Size

        Gzip bytes of the minified stylesheet.

        | Workload | Zyzz | Panda CSS | StyleX | Tailwind | Tamagui | vanilla-extract | Zyzz vs. Best Competitor |
        | :--- | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
        | 3 Components | **100** | 110 | 120 | 130 | 140 | 150 | 🟢 10 B smaller than Panda CSS |
        | 1,000 Components: Repeated Styles | **200** | 210 | 220 | 230 | 240 | 250 | 🟢 10 B smaller than Panda CSS |
        | 1,000 Components: Unique Padding | **300** | 310 | 320 | 330 | 340 | 350 | 🟢 10 B smaller than Panda CSS |
        | 100 Components: Partial Sharing | **400** | 410 | 420 | 430 | 440 | 450 | 🟢 10 B smaller than Panda CSS |
        | 100 Components: Reused Palette | **500** | 510 | 520 | 530 | 540 | 550 | 🟢 10 B smaller than Panda CSS |
        | 100 Components: Independent Values | **600** | 610 | 620 | 630 | 640 | 650 | 🟢 10 B smaller than Panda CSS |
        | 100 Components: Sparse Properties | **700** | 710 | 720 | 730 | 740 | 750 | 🟢 10 B smaller than Panda CSS |
        | 60 Components: Mixed Shapes | **800** | 810 | 820 | 830 | 840 | 850 | 🟢 10 B smaller than Panda CSS |
        | 300 Components: Application Scale | **900** | 910 | 920 | 930 | 940 | 950 | 🟢 10 B smaller than Panda CSS |
        | Themes: 10 Components | **1,010** | 1,020 | 1,030 | 1,040 | 1,050 | 1,060 | 🟢 10 B smaller than Panda CSS |
        | Themes: 100 Components | **1,110** | 1,120 | 1,130 | 1,140 | 1,150 | 1,160 | 🟢 10 B smaller than Panda CSS |

        ## JS Size

        Gzip bytes of the bundled client JavaScript, including required runtime helpers.

        | Workload | Zyzz | Panda CSS | StyleX | Tailwind | Tamagui | vanilla-extract | Zyzz vs. Best Competitor |
        | :--- | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
        | 3 Components | 50 | 51 | 52 | 53 | 54 | **40** | 🔴 10 B larger than vanilla-extract |
        | 1,000 Components: Repeated Styles | 50 | 51 | 52 | 53 | 54 | **40** | 🔴 10 B larger than vanilla-extract |
        | 1,000 Components: Unique Padding | 50 | 51 | 52 | 53 | 54 | **40** | 🔴 10 B larger than vanilla-extract |
        | 100 Components: Partial Sharing | 50 | 51 | 52 | 53 | 54 | **40** | 🔴 10 B larger than vanilla-extract |
        | 100 Components: Reused Palette | 50 | 51 | 52 | 53 | 54 | **40** | 🔴 10 B larger than vanilla-extract |
        | 100 Components: Independent Values | 50 | 51 | 52 | 53 | 54 | **40** | 🔴 10 B larger than vanilla-extract |
        | 100 Components: Sparse Properties | 50 | 51 | 52 | 53 | 54 | **40** | 🔴 10 B larger than vanilla-extract |
        | 60 Components: Mixed Shapes | 50 | 51 | 52 | 53 | 54 | **40** | 🔴 10 B larger than vanilla-extract |
        | 300 Components: Application Scale | 50 | 51 | 52 | 53 | 54 | **40** | 🔴 10 B larger than vanilla-extract |
        | Themes: 10 Components | 51 | 52 | 53 | 54 | 55 | **40** | 🔴 11 B larger than vanilla-extract |
        | Themes: 100 Components | 51 | 52 | 53 | 54 | 55 | **40** | 🔴 11 B larger than vanilla-extract |

        ## Notes

        - **Gate:** Zyzz must beat every competitor on mean compile time and on total gzip size (CSS plus JS). The application workload gates size only.
        - **Zyzz lanes:** Literal workloads start from validated definitions. The application workload transforms one authored module, including parsing. Theme workloads include token resolution.
        - **More results:** The [workflow run](https://github.com/wevm/zyzz/actions/runs/1) has error margins, sample counts, raw and Brotli sizes, baseline comparisons, and render timings.
        "
      `)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
  })

  test('missing workload', async () => {
    const directory = await Fs.mkdtemp(Path.resolve('.fixture-comment-'))

    try {
      await results(directory, { missing: 'tamagui' })

      const output = await comment(directory, { gate: true })
      const lines = output.split('\n')

      expect(lines.slice(2, 5)).toMatchInlineSnapshot(`
        [
          "🔴 Zyzz fails the framework gate in 1 of 11 workloads:",
          "",
          "- 300 Components: Application Scale",
        ]
      `)
      expect(lines.filter((line) => line.startsWith('| 300 Components')))
        .toMatchInlineSnapshot(`
        [
          "| 300 Components: Application Scale | n/a | n/a | n/a | n/a | n/a | n/a | Missing measurements |",
          "| 300 Components: Application Scale | n/a | n/a | n/a | n/a | n/a | n/a | Missing measurements |",
          "| 300 Components: Application Scale | n/a | n/a | n/a | n/a | n/a | n/a | Missing measurements |",
        ]
      `)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
  })

  test('missing results', async () => {
    const directory = await Fs.mkdtemp(Path.resolve('.fixture-comment-'))

    try {
      const output = await comment(directory, { gate: false })

      expect(output).toMatchInlineSnapshot(`
        "# Benchmark Report

        Framework results are unavailable. See the [workflow run](https://github.com/wevm/zyzz/actions/runs/1).
        "
      `)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
  })
})
