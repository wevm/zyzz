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

        Every workload compiles from fresh compiler state, including Lightning CSS minification and esbuild client bundling. Lower is better, bold marks the best result in each row, and the ratio beside each competitor compares its result with Zyzz.

        ## Compile Time

        Mean milliseconds per compilation.

        | Workload | Zyzz | Panda CSS | StyleX | Tailwind | Tamagui | vanilla-extract | Zyzz vs. Best Competitor |
        | :--- | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
        | 3 Components | **1.00** | 1.25&nbsp;(1.25×) | 1.50&nbsp;(1.50×) | 1.75&nbsp;(1.75×) | 2.00&nbsp;(2.00×) | 2.25&nbsp;(2.25×) | 🟢 1.25× faster than Panda CSS |
        | 1,000 Components: Repeated Styles | **2.00** | 2.25&nbsp;(1.13×) | 2.50&nbsp;(1.25×) | 2.75&nbsp;(1.38×) | 3.00&nbsp;(1.50×) | 3.25&nbsp;(1.63×) | 🟢 1.13× faster than Panda CSS |
        | 1,000 Components: Unique Padding | **3.00** | 3.25&nbsp;(1.08×) | 3.50&nbsp;(1.17×) | 3.75&nbsp;(1.25×) | 4.00&nbsp;(1.33×) | 4.25&nbsp;(1.42×) | 🟢 1.08× faster than Panda CSS |
        | 100 Components: Partial Sharing | **4.00** | 4.25&nbsp;(1.06×) | 4.50&nbsp;(1.13×) | 4.75&nbsp;(1.19×) | 5.00&nbsp;(1.25×) | 5.25&nbsp;(1.31×) | 🟢 1.06× faster than Panda CSS |
        | 100 Components: Reused Palette | **5.00** | 5.25&nbsp;(1.05×) | 5.50&nbsp;(1.10×) | 5.75&nbsp;(1.15×) | 6.00&nbsp;(1.20×) | 6.25&nbsp;(1.25×) | 🟢 1.05× faster than Panda CSS |
        | 100 Components: Independent Values | **6.00** | 6.25&nbsp;(1.04×) | 6.50&nbsp;(1.08×) | 6.75&nbsp;(1.13×) | 7.00&nbsp;(1.17×) | 7.25&nbsp;(1.21×) | 🟢 1.04× faster than Panda CSS |
        | 100 Components: Sparse Properties | **7.00** | 7.25&nbsp;(1.04×) | 7.50&nbsp;(1.07×) | 7.75&nbsp;(1.11×) | 8.00&nbsp;(1.14×) | 8.25&nbsp;(1.18×) | 🟢 1.04× faster than Panda CSS |
        | 60 Components: Mixed Shapes | **8.00** | 8.25&nbsp;(1.03×) | 8.50&nbsp;(1.06×) | 8.75&nbsp;(1.09×) | 9.00&nbsp;(1.13×) | 9.25&nbsp;(1.16×) | 🟢 1.03× faster than Panda CSS |
        | 300 Components: Application Scale | **9.00** | 9.25&nbsp;(1.03×) | 9.50&nbsp;(1.06×) | 9.75&nbsp;(1.08×) | 10.00&nbsp;(1.11×) | 10.25&nbsp;(1.14×) | 🟢 1.03× faster than Panda CSS |
        | Themes: 10 Components | **10.25** | 10.50&nbsp;(1.02×) | 10.75&nbsp;(1.05×) | 11.00&nbsp;(1.07×) | 11.25&nbsp;(1.10×) | 11.50&nbsp;(1.12×) | 🟢 1.02× faster than Panda CSS |
        | Themes: 100 Components | **11.25** | 11.50&nbsp;(1.02×) | 11.75&nbsp;(1.04×) | 12.00&nbsp;(1.07×) | 12.25&nbsp;(1.09×) | 12.50&nbsp;(1.11×) | 🟢 1.02× faster than Panda CSS |

        ## CSS Size

        Gzip bytes of the minified stylesheet.

        | Workload | Zyzz | Panda CSS | StyleX | Tailwind | Tamagui | vanilla-extract | Zyzz vs. Best Competitor |
        | :--- | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
        | 3 Components | **100** | 110&nbsp;(1.10×) | 120&nbsp;(1.20×) | 130&nbsp;(1.30×) | 140&nbsp;(1.40×) | 150&nbsp;(1.50×) | 🟢 10 B smaller than Panda CSS |
        | 1,000 Components: Repeated Styles | **200** | 210&nbsp;(1.05×) | 220&nbsp;(1.10×) | 230&nbsp;(1.15×) | 240&nbsp;(1.20×) | 250&nbsp;(1.25×) | 🟢 10 B smaller than Panda CSS |
        | 1,000 Components: Unique Padding | **300** | 310&nbsp;(1.03×) | 320&nbsp;(1.07×) | 330&nbsp;(1.10×) | 340&nbsp;(1.13×) | 350&nbsp;(1.17×) | 🟢 10 B smaller than Panda CSS |
        | 100 Components: Partial Sharing | **400** | 410&nbsp;(1.02×) | 420&nbsp;(1.05×) | 430&nbsp;(1.07×) | 440&nbsp;(1.10×) | 450&nbsp;(1.13×) | 🟢 10 B smaller than Panda CSS |
        | 100 Components: Reused Palette | **500** | 510&nbsp;(1.02×) | 520&nbsp;(1.04×) | 530&nbsp;(1.06×) | 540&nbsp;(1.08×) | 550&nbsp;(1.10×) | 🟢 10 B smaller than Panda CSS |
        | 100 Components: Independent Values | **600** | 610&nbsp;(1.02×) | 620&nbsp;(1.03×) | 630&nbsp;(1.05×) | 640&nbsp;(1.07×) | 650&nbsp;(1.08×) | 🟢 10 B smaller than Panda CSS |
        | 100 Components: Sparse Properties | **700** | 710&nbsp;(1.01×) | 720&nbsp;(1.03×) | 730&nbsp;(1.04×) | 740&nbsp;(1.06×) | 750&nbsp;(1.07×) | 🟢 10 B smaller than Panda CSS |
        | 60 Components: Mixed Shapes | **800** | 810&nbsp;(1.01×) | 820&nbsp;(1.02×) | 830&nbsp;(1.04×) | 840&nbsp;(1.05×) | 850&nbsp;(1.06×) | 🟢 10 B smaller than Panda CSS |
        | 300 Components: Application Scale | **900** | 910&nbsp;(1.01×) | 920&nbsp;(1.02×) | 930&nbsp;(1.03×) | 940&nbsp;(1.04×) | 950&nbsp;(1.06×) | 🟢 10 B smaller than Panda CSS |
        | Themes: 10 Components | **1,010** | 1,020&nbsp;(1.01×) | 1,030&nbsp;(1.02×) | 1,040&nbsp;(1.03×) | 1,050&nbsp;(1.04×) | 1,060&nbsp;(1.05×) | 🟢 10 B smaller than Panda CSS |
        | Themes: 100 Components | **1,110** | 1,120&nbsp;(1.01×) | 1,130&nbsp;(1.02×) | 1,140&nbsp;(1.03×) | 1,150&nbsp;(1.04×) | 1,160&nbsp;(1.05×) | 🟢 10 B smaller than Panda CSS |

        ## JS Size

        Gzip bytes of the bundled client JavaScript, including required runtime helpers.

        | Workload | Zyzz | Panda CSS | StyleX | Tailwind | Tamagui | vanilla-extract | Zyzz vs. Best Competitor |
        | :--- | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
        | 3 Components | 50 | 51&nbsp;(1.02×) | 52&nbsp;(1.04×) | 53&nbsp;(1.06×) | 54&nbsp;(1.08×) | **40**&nbsp;(0.80×) | 🔴 10 B larger than vanilla-extract |
        | 1,000 Components: Repeated Styles | 50 | 51&nbsp;(1.02×) | 52&nbsp;(1.04×) | 53&nbsp;(1.06×) | 54&nbsp;(1.08×) | **40**&nbsp;(0.80×) | 🔴 10 B larger than vanilla-extract |
        | 1,000 Components: Unique Padding | 50 | 51&nbsp;(1.02×) | 52&nbsp;(1.04×) | 53&nbsp;(1.06×) | 54&nbsp;(1.08×) | **40**&nbsp;(0.80×) | 🔴 10 B larger than vanilla-extract |
        | 100 Components: Partial Sharing | 50 | 51&nbsp;(1.02×) | 52&nbsp;(1.04×) | 53&nbsp;(1.06×) | 54&nbsp;(1.08×) | **40**&nbsp;(0.80×) | 🔴 10 B larger than vanilla-extract |
        | 100 Components: Reused Palette | 50 | 51&nbsp;(1.02×) | 52&nbsp;(1.04×) | 53&nbsp;(1.06×) | 54&nbsp;(1.08×) | **40**&nbsp;(0.80×) | 🔴 10 B larger than vanilla-extract |
        | 100 Components: Independent Values | 50 | 51&nbsp;(1.02×) | 52&nbsp;(1.04×) | 53&nbsp;(1.06×) | 54&nbsp;(1.08×) | **40**&nbsp;(0.80×) | 🔴 10 B larger than vanilla-extract |
        | 100 Components: Sparse Properties | 50 | 51&nbsp;(1.02×) | 52&nbsp;(1.04×) | 53&nbsp;(1.06×) | 54&nbsp;(1.08×) | **40**&nbsp;(0.80×) | 🔴 10 B larger than vanilla-extract |
        | 60 Components: Mixed Shapes | 50 | 51&nbsp;(1.02×) | 52&nbsp;(1.04×) | 53&nbsp;(1.06×) | 54&nbsp;(1.08×) | **40**&nbsp;(0.80×) | 🔴 10 B larger than vanilla-extract |
        | 300 Components: Application Scale | 50 | 51&nbsp;(1.02×) | 52&nbsp;(1.04×) | 53&nbsp;(1.06×) | 54&nbsp;(1.08×) | **40**&nbsp;(0.80×) | 🔴 10 B larger than vanilla-extract |
        | Themes: 10 Components | 51 | 52&nbsp;(1.02×) | 53&nbsp;(1.04×) | 54&nbsp;(1.06×) | 55&nbsp;(1.08×) | **40**&nbsp;(0.78×) | 🔴 11 B larger than vanilla-extract |
        | Themes: 100 Components | 51 | 52&nbsp;(1.02×) | 53&nbsp;(1.04×) | 54&nbsp;(1.06×) | 55&nbsp;(1.08×) | **40**&nbsp;(0.78×) | 🔴 11 B larger than vanilla-extract |

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
