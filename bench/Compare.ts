/**
 * Reports benchmark changes and prepares github-action-benchmark input.
 * @module
 */
import * as Fs from 'node:fs'
import * as Path from 'node:path'

type Measurement = {
  error: number
  unit: 'B' | 'ms'
  value: number
}

type Sizes = {
  css?: { gzip: number }
  gzip?: number
  javascript?: { gzip: number }
  total?: { gzip: number }
}

type Timings = {
  files: readonly {
    groups: readonly {
      benchmarks: readonly {
        mean: number
        name: string
        rme: number
      }[]
      fullName: string
    }[]
  }[]
}

const [candidate, baseline, output] = process.argv.slice(2)
const thresholds = {
  B: threshold('BENCH_SIZE_THRESHOLD', 105),
  ms: threshold('BENCH_TIME_THRESHOLD', 110),
}
const competitors = new Set(['panda', 'stylex', 'tailwind', 'vanilla-extract'])
if (!candidate || !output)
  throw new Error(
    'Usage: node bench/Compare.ts <results> <baseline-or-empty> <action-output>',
  )

const current = read(candidate)
const hasBaseline = Boolean(
  baseline && Fs.existsSync(Path.join(baseline, 'timings.json')),
)
const previous =
  hasBaseline && baseline ? read(baseline) : new Map<string, Measurement>()
const commit =
  hasBaseline && baseline
    ? Fs.readFileSync(Path.join(baseline, 'commit.txt'), 'utf8').trim()
    : ''
if (output) {
  Fs.mkdirSync(output, { recursive: true })
  for (const [name, unit] of [
    ['size', 'B'],
    ['time', 'ms'],
  ] as const) {
    const benches = (measurements: Map<string, Measurement>) =>
      [...measurements]
        .filter(([, value]) => value.unit === unit)
        .map(([name, value]) => ({
          name,
          range: `± ${(value.value * value.error) / 100}`,
          unit,
          value: value.value,
        }))
    Fs.writeFileSync(
      Path.join(output, `${name}.json`),
      JSON.stringify(benches(current)),
    )
    Fs.writeFileSync(
      Path.join(output, `${name}-baseline.json`),
      JSON.stringify({
        entries: {
          [name]: commit
            ? [
                {
                  benches: benches(previous),
                  commit: { id: commit },
                  date: 0,
                  tool: 'customSmallerIsBetter',
                },
              ]
            : [],
        },
        lastUpdate: 0,
        repoUrl: `https://github.com/${process.env.GITHUB_REPOSITORY ?? 'wevm/zyzz'}`,
      }),
    )
  }
}

console.log('## Compared with main\n')
if (!hasBaseline) {
  console.log('No baseline available.\n')
} else {
  const repository = process.env.GITHUB_REPOSITORY ?? 'wevm/zyzz'
  console.log(
    `Baseline: [main @ ${commit.slice(0, 7)}](https://github.com/${repository}/commit/${commit})\n`,
  )
  console.log(
    '🟢 Improved · 🟡 Within tolerance / unchanged · 🔴 Regression above threshold\n',
  )
  console.log(
    `Timing changes above ${thresholds.ms - 100}% are advisory. Gzip growth above ${thresholds.B - 100}% fails PR/manual checks. Zyzz measurements only; timings come from separate CI runners. Reported timing errors are informational.\n`,
  )
  console.log('| Benchmark | Main | PR / current | Change |')
  console.log('| --- | ---: | ---: | ---: |')

  for (const key of new Set([...current.keys(), ...previous.keys()])) {
    const before = previous.get(key)
    const after = current.get(key)
    const name = key
      .replace(/^.*? > /, '')
      .replaceAll('|', '\\|')
      .replaceAll(/\r?\n/g, ' ')
    if (!before || !after) {
      console.log(
        `| ${name} | ${before ? format(before) : '—'} | ${after ? format(after) : '—'} | ${after ? 'New' : 'Removed'} |`,
      )
      continue
    }

    const delta = after.value - before.value
    const percent =
      delta === 0
        ? 0
        : before.value === 0
          ? undefined
          : (delta / before.value) * 100
    const ratio =
      before.value === 0 && after.value === 0 ? 1 : after.value / before.value
    const tolerance = thresholds[after.unit] / 100
    const significant = delta > 0 ? ratio > tolerance : ratio < 2 - tolerance
    const light = !significant ? '🟡' : delta < 0 ? '🟢' : '🔴'
    const change =
      percent === undefined
        ? 'new from zero'
        : `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`
    const bytes =
      after.unit === 'B' ? `${delta > 0 ? '+' : ''}${delta} B · ` : ''
    console.log(
      `| ${name} | ${format(before)} | ${format(after)} | ${light} ${bytes}${change} |`,
    )
  }
  console.log('')
}

function format(measurement: Measurement) {
  return `${measurement.unit === 'B' ? measurement.value : Number(measurement.value.toPrecision(4))} ${measurement.unit}${measurement.unit === 'ms' ? ` ±${measurement.error.toFixed(1)}%` : ''}`
}

function read(directory: string) {
  const measurements = new Map<string, Measurement>()
  const timings: Timings = JSON.parse(
    Fs.readFileSync(Path.join(directory, 'timings.json'), 'utf8'),
  )
  for (const file of timings.files) {
    for (const group of file.groups) {
      for (const benchmark of group.benchmarks) {
        if (competitors.has(benchmark.name)) continue
        measurements.set(`${group.fullName} / ${benchmark.name}`, {
          error: benchmark.rme,
          unit: 'ms',
          // Tinybench means are already milliseconds; the summary only rounds them.
          value: benchmark.mean,
        })
      }
    }
  }

  for (const file of [...Fs.globSync('**/*.json', { cwd: directory })].sort()) {
    if (file === 'timings.json') continue
    if (competitors.has(Path.basename(file, '.json'))) continue
    const sizes: Sizes = JSON.parse(
      Fs.readFileSync(Path.join(directory, file), 'utf8'),
    )
    const name = file.replace(/\.json$/, '')
    for (const [metric, value] of [
      ['CSS gzip', sizes.css?.gzip ?? sizes.gzip],
      ['JS gzip', sizes.javascript?.gzip],
      ['Total gzip', sizes.total?.gzip],
    ] as const) {
      if (value === undefined) continue
      measurements.set(`${name} / ${metric}`, { error: 0, unit: 'B', value })
    }
  }
  return measurements
}
function threshold(name: string, fallback: number) {
  const input = process.env[name]
  if (input === undefined) return fallback
  const value = Number(input)
  if (!input.trim() || !Number.isFinite(value) || value < 100)
    throw new Error(`${name} must be a finite percentage ratio of at least 100`)
  return value
}
