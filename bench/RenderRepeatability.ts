/**
 * Reports cross-run dispersion and framework interval overlap for repeated
 * production browser render runs.
 * @module
 */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import type * as Render from './Render.js'
import type * as RenderFixture from './RenderFixture.js'

type Metric = 'commit' | 'commitLayout' | 'frame'

type Run = {
  groups: readonly Render.Group[]
  name: string
  userAgent: string
}

/** Cross-run statistics for one framework, operation, and metric. */
type Series = {
  /** Sample coefficient of variation as a percentage of the mean. */
  cv: number
  /** Highest per-run value in milliseconds. */
  max: number
  /** Arithmetic mean of the per-run values in milliseconds. */
  mean: number
  /** Lowest per-run value in milliseconds. */
  min: number
  /** Ratio of the highest to the lowest per-run value, minus one, as a percentage. */
  spread: number
  /** One value per run: the mean of both pass medians. */
  values: readonly number[]
}

const competitors = ['panda', 'stylex', 'tailwind', 'vanilla-extract'] as const
const inputs = process.argv.slice(2)
const metrics: readonly { key: Metric; title: string }[] = [
  { key: 'commit', title: 'commit' },
  { key: 'commitLayout', title: 'commit + layout' },
  { key: 'frame', title: 'frame' },
]
const names: Record<string, string> = {
  baseline: 'Plain class/style',
  panda: 'Panda CSS',
  stylex: 'StyleX',
  tailwind: 'Tailwind',
  'vanilla-extract': 'vanilla-extract',
  zyzz: 'Zyzz',
}
const operations = ['mount', 'update', 'remount'] as const
if (inputs.length < 2)
  throw new Error(
    'Usage: node bench/RenderRepeatability.ts <render-timings.json or results directory>...',
  )

const runs = await Promise.all(inputs.map(read))
for (const run of runs) validate(run)
console.log('## Production React Render Repeatability\n')
console.log(
  `${runs.length} sequential runs: ${runs.map((run) => `\`${run.name}\``).join(', ')}. Each per-run value is the mean of the two pass medians, the statistic RenderReport ranks. Spread is max ÷ min − 1 across runs; CV is the sample standard deviation divided by the mean.\n`,
)
console.log(
  'Overlap compares the min–max interval of Zyzz’s per-run values with each competitor’s interval. Overlapping intervals are inconclusive. A separated interval reports the direction without a speed claim; run-to-run drift is still present in both intervals.\n',
)
for (const userAgent of new Set(runs.map((run) => run.userAgent)))
  console.log(`Browser: ${userAgent}\n`)

const worst = new Map<Metric, { spread: number; where: string }>()
for (const components of [100, 1000])
  for (const kind of ['callable', 'overrides', 'dynamic'] as const) {
    const libraries =
      kind === 'dynamic'
        ? (['baseline', 'zyzz'] as const)
        : ([
            'baseline',
            'panda',
            'stylex',
            'tailwind',
            'vanilla-extract',
            'zyzz',
          ] as const)
    const table = new Map<string, Series>()

    for (const library of libraries)
      for (const operation of operations)
        for (const metric of metrics)
          table.set(
            `${library}/${operation}/${metric.key}`,
            series(
              runs.map((run) =>
                value(run, {
                  components,
                  kind,
                  library,
                  metric: metric.key,
                  operation,
                }),
              ),
            ),
          )

    const zyzzSpread = metrics.map((metric) => {
      const spread = Math.max(
        ...operations.map(
          (operation) => table.get(`zyzz/${operation}/${metric.key}`)!.spread,
        ),
      )

      return `${metric.title} spread ≤ ${spread.toFixed(1)}%`
    })

    console.log(
      `<details>\n<summary>${components} cards — ${kind} · Zyzz ${zyzzSpread.join(' · ')}</summary>\n`,
    )
    console.log(
      '| Framework | Operation | Metric | Min ms | Mean ms | Max ms | Spread | CV | Runs |',
    )
    console.log('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |')

    for (const library of libraries)
      for (const operation of operations)
        for (const metric of metrics) {
          const entry = table.get(`${library}/${operation}/${metric.key}`)!

          console.log(
            `| ${names[library]} | ${operation} | ${metric.title} | ${entry.min.toFixed(2)} | ${entry.mean.toFixed(2)} | ${entry.max.toFixed(2)} | ${entry.spread.toFixed(1)}% | ${entry.cv.toFixed(1)}% | ${entry.values.map((item) => item.toFixed(2)).join(' / ')} |`,
          )

          if (library !== 'zyzz') continue

          const current = worst.get(metric.key)
          if (!current || entry.spread > current.spread)
            worst.set(metric.key, {
              spread: entry.spread,
              where: `${components} cards ${kind} ${operation}`,
            })
        }

    console.log('\nInterval overlap against Zyzz:\n')
    console.log(
      '| Competitor | Operation | Metric | Zyzz min–max ms | Competitor min–max ms | Result |',
    )
    console.log('| --- | --- | --- | ---: | ---: | --- |')

    for (const competitor of ['baseline', ...competitors])
      for (const operation of operations)
        for (const metric of metrics) {
          const other = table.get(`${competitor}/${operation}/${metric.key}`)
          if (!other) continue

          const zyzz = table.get(`zyzz/${operation}/${metric.key}`)!

          console.log(
            `| ${names[competitor]} | ${operation} | ${metric.title} | ${zyzz.min.toFixed(2)}–${zyzz.max.toFixed(2)} | ${other.min.toFixed(2)}–${other.max.toFixed(2)} | ${overlap(zyzz, other)} |`,
          )
        }

    console.log('\n</details>\n')
  }
console.log('### Gate guidance\n')
console.log(
  'Largest Zyzz run-to-run spread on this machine. A single-pair regression threshold must exceed the observed spread with margin, or repeated runs must be confirmed before failing.\n',
)
console.log('| Metric | Largest Zyzz spread | Workload |')
console.log('| --- | ---: | --- |')
for (const metric of metrics) {
  const entry = worst.get(metric.key)!

  console.log(
    `| ${metric.title} | ${entry.spread.toFixed(1)}% | ${entry.where} |`,
  )
}
console.log(
  '\nThese runs share one machine, browser, and source revision. They bound drift between sequential runs; they do not bound differences between machines or runners.\n',
)

/** Describes the interval relation between Zyzz and one competitor. */
function overlap(zyzz: Series, other: Series): string {
  if (zyzz.min <= other.max && other.min <= zyzz.max)
    return 'Overlap — inconclusive'
  if (zyzz.max < other.min) return 'Zyzz lower in every run'

  return 'Zyzz higher in every run'
}

/** Loads a run from a timings file or a results directory containing one. */
async function read(input: string): Promise<Run> {
  const path = await (async () => {
    const stats = await Fs.stat(input)
    if (stats.isDirectory()) return Path.join(input, 'render-timings.json')

    return input
  })()

  const data = JSON.parse(await Fs.readFile(path, 'utf8')) as {
    groups: readonly Render.Group[]
    userAgent: string
  }

  return { groups: data.groups, name: input, userAgent: data.userAgent }
}

/** Summarizes one value per run. */
function series(values: readonly number[]): Series {
  const mean = values.reduce((sum, item) => sum + item, 0) / values.length
  const min = Math.min(...values)
  const max = Math.max(...values)
  const variance =
    values.reduce((sum, item) => sum + (item - mean) ** 2, 0) /
    (values.length - 1)

  return {
    cv: mean > 0 ? (Math.sqrt(variance) / mean) * 100 : 0,
    max,
    mean,
    min,
    spread: min > 0 ? (max / min - 1) * 100 : 0,
    values,
  }
}

/** Rejects incomplete or inconsistent runs before comparing them. */
function validate(run: Run) {
  let expected = 0

  for (const components of [100, 1000])
    for (const kind of ['callable', 'overrides', 'dynamic'])
      for (const library of kind === 'dynamic'
        ? ['baseline', 'zyzz']
        : [
            'baseline',
            'panda',
            'stylex',
            'tailwind',
            'vanilla-extract',
            'zyzz',
          ])
        for (const pass of [1, 2]) {
          expected++

          const matches = run.groups.filter(
            (group) =>
              group.components === components &&
              group.count === components / 10 &&
              group.kind === kind &&
              group.library === library &&
              group.pass === pass,
          )
          if (matches.length !== 1)
            throw new Error(
              `${run.name}: missing or duplicate group ${components}/${kind}/${library}/${pass}`,
            )

          for (const operation of operations) {
            const samples = matches[0]!.samples.filter(
              (sample) => sample.operation === operation,
            )
            if (
              samples.length !== 20 ||
              samples.some(
                (sample) =>
                  ![sample.commit, sample.commitLayout, sample.frame].every(
                    (item) => Number.isFinite(item) && item >= 0,
                  ) ||
                  sample.commitLayout < sample.commit ||
                  sample.frame < sample.commitLayout,
              )
            )
              throw new Error(
                `${run.name}: invalid ${operation} samples in ${components}/${kind}/${library}/${pass}`,
              )
          }
        }

  if (run.groups.length !== expected)
    throw new Error(`${run.name}: unexpected groups`)
}

/** Returns the mean of both pass medians for one framework measurement. */
function value(run: Run, options: value.Options): number {
  const passes = run.groups.filter(
    (group) =>
      group.components === options.components &&
      group.kind === options.kind &&
      group.library === options.library,
  )

  const medians = passes.map((group) => {
    const sorted = group.samples
      .filter((sample) => sample.operation === options.operation)
      .map((sample) => sample[options.metric])
      .sort((a, b) => a - b)

    return sorted[Math.ceil(sorted.length / 2) - 1]!
  })

  return medians.reduce((sum, item) => sum + item, 0) / medians.length
}

/** Selects one framework measurement across both passes of a run. */
declare namespace value {
  /** Workload, framework, operation, and timing checkpoint. */
  type Options = {
    /** Rendered card count. */
    components: number
    /** Workload implemented by the React fixture. */
    kind: Render.Group['kind']
    /** Framework lane. */
    library: string
    /** Timing checkpoint. */
    metric: Metric
    /** Tree operation. */
    operation: RenderFixture.Sample['operation']
  }
}
