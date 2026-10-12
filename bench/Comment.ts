/**
 * Formats the framework measurements that `bench/Check.ts` records into the pull request
 * benchmark comment: compile time, CSS size, and JavaScript size for every library.
 * @module
 */
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import type * as Check from './Check.js'

type Column = {
  /** Benchmark lane name. */
  readonly library: string
  /** Display name. */
  readonly name: string
}

type Metric = {
  /** Describes a lower Zyzz value. */
  readonly better: string
  /** Formats how far apart two values are. */
  readonly delta: (a: number, b: number) => string
  /** Unit and scope shown above the table. */
  readonly description: string
  /** Formats one measured value. */
  readonly format: (value: number) => string
  /** Section heading. */
  readonly title: string
  /** Reads the compared value. */
  readonly value: (result: Result) => number
  /** Describes a higher Zyzz value. */
  readonly worse: string
}

type Result = Workload['results'][number]

type Workload = Check.Summary['workloads'][number]

const [directory, run] = process.argv.slice(2)
if (!directory || !run)
  throw new Error('Usage: node bench/Comment.ts <results> <run-url>')

const path = Path.join(directory, 'frameworks.json')
const bytes = (value: number) => value.toLocaleString('en-US')
const metrics: readonly Metric[] = [
  {
    better: 'faster',
    delta: (a, b) => `${(Math.max(a, b) / Math.min(a, b)).toFixed(2)}×`,
    description: 'Mean milliseconds per compilation.',
    format: (value) => value.toFixed(2),
    title: 'Compile Time',
    value: (result) => result.mean,
    worse: 'slower',
  },
  {
    better: 'smaller',
    delta: (a, b) => `${bytes(Math.abs(a - b))} B`,
    description: 'Gzip bytes of the minified stylesheet.',
    format: bytes,
    title: 'CSS Size',
    value: (result) => result.css,
    worse: 'larger',
  },
  {
    better: 'smaller',
    delta: (a, b) => `${bytes(Math.abs(a - b))} B`,
    description:
      'Gzip bytes of the bundled client JavaScript, including required runtime helpers.',
    format: bytes,
    title: 'JS Size',
    value: (result) => result.javascript,
    worse: 'larger',
  },
]

console.log('# Benchmark Report\n')

if (Fs.existsSync(path)) {
  const summary: Check.Summary = JSON.parse(Fs.readFileSync(path, 'utf8'))

  console.log(comment(summary))
} else
  console.log(
    `Framework results are unavailable. See the [workflow run](${run}).`,
  )

/** Renders the gate status, one table per metric, and the measurement notes. */
function comment(summary: Check.Summary): string {
  const failed = summary.workloads.filter((workload) => !workload.passed)
  const status = (() => {
    if (!failed.length)
      return `🟢 Zyzz passes the framework gate in all ${summary.workloads.length} workloads.`

    return `🔴 Zyzz fails the framework gate in ${failed.length} of ${summary.workloads.length} workloads:\n\n${failed.map((workload) => `- ${workload.title}`).join('\n')}`
  })()
  const names = new Map(
    summary.workloads.flatMap((workload) =>
      workload.results.map((result) => [result.library, result.name] as const),
    ),
  )
  const columns: readonly Column[] = [
    ...new Set(summary.workloads.flatMap((workload) => workload.competitors)),
  ].map((library) => ({ library, name: names.get(library) ?? library }))

  return [
    status,
    'Every workload compiles from fresh compiler state, including Lightning CSS minification and esbuild client bundling. Lower is better, and bold marks the best result in each row.',
    ...metrics.map((metric) => table({ columns, metric, summary })),
    '## Notes',
    [
      '- **Gate:** Zyzz must beat every competitor on mean compile time and on total gzip size (CSS plus JS). The application workload gates size only.',
      '- **Zyzz lanes:** Literal workloads start from validated definitions. The application workload transforms one authored module, including parsing. Theme workloads include token resolution.',
      `- **More results:** The [workflow run](${run}) has error margins, sample counts, raw and Brotli sizes, baseline comparisons, and render timings.`,
    ].join('\n'),
  ].join('\n\n')
}

/** Renders one metric with a row per workload and a column per library. */
function table(options: table.Options): string {
  const { columns, metric, summary } = options
  const header = `| Workload | Zyzz | ${columns.map((column) => column.name).join(' | ')} | Zyzz vs. Best Competitor |`
  const divider = `| :--- | ---: | ${columns.map(() => '---:').join(' | ')} | :--- |`
  const rows = summary.workloads.map((workload) => {
    const zyzz = workload.results.find(
      (result) => result.library === workload.lanes.at(-1),
    )
    const others = columns.map((column) =>
      workload.results.find((result) => result.library === column.library),
    )
    const measured = others.filter((result) => result !== undefined)

    if (!zyzz || !measured.length)
      return `| ${workload.title} | n/a | ${columns.map(() => 'n/a').join(' | ')} | Missing measurements |`

    const best = Math.min(...[zyzz, ...measured].map(metric.value))
    const cell = (result: Result | undefined) => {
      if (!result) return 'n/a'

      const value = metric.value(result)

      return value === best
        ? `**${metric.format(value)}**`
        : metric.format(value)
    }

    return `| ${workload.title} | ${cell(zyzz)} | ${others.map(cell).join(' | ')} | ${compare({ metric, others: measured, zyzz })} |`
  })

  return [
    `## ${metric.title}`,
    metric.description,
    [header, divider, ...rows].join('\n'),
  ].join('\n\n')
}

/** Inputs for one metric table. */
declare namespace table {
  type Options = {
    /** Competitor columns in display order. */
    readonly columns: readonly Column[]
    /** Compared metric. */
    readonly metric: Metric
    /** Recorded workloads in row order. */
    readonly summary: Check.Summary
  }
}

/** Describes Zyzz against the competitor with the lowest value. */
function compare(options: compare.Options): string {
  const { metric, others, zyzz } = options
  const rival = others.reduce((best, result) =>
    metric.value(result) < metric.value(best) ? result : best,
  )
  const value = metric.value(zyzz)
  const other = metric.value(rival)

  if (value === other) return `🟡 Tied with ${rival.name}`

  const delta = metric.delta(value, other)

  if (value < other) return `🟢 ${delta} ${metric.better} than ${rival.name}`

  return `🔴 ${delta} ${metric.worse} than ${rival.name}`
}

/** Inputs for one Zyzz comparison. */
declare namespace compare {
  type Options = {
    /** Compared metric. */
    readonly metric: Metric
    /** Measured competitors, at least one. */
    readonly others: readonly Result[]
    /** The lane that represents Zyzz. */
    readonly zyzz: Result
  }
}
