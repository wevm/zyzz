/**
 * Reports benchmark changes and optionally fails on configured regressions.
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

const [candidate, baseline, check] = process.argv.slice(2)
const competitors = new Set(['panda', 'stylex', 'tailwind', 'vanilla-extract'])
const thresholds = {
  B: threshold('BENCH_SIZE_THRESHOLD', 5),
  ms: threshold('BENCH_TIME_THRESHOLD', 10),
}
if (!candidate)
  throw new Error('Usage: node bench/Compare.ts <results> [baseline] [--check]')
if (check !== undefined && check !== '--check')
  throw new Error(`Unknown option: ${check}`)

console.log('## Compared with main\n')
if (!baseline || !Fs.existsSync(Path.join(baseline, 'timings.json'))) {
  console.log('No baseline available.\n')
} else {
  const commit = Fs.readFileSync(
    Path.join(baseline, 'commit.txt'),
    'utf8',
  ).trim()
  const repository = process.env.GITHUB_REPOSITORY ?? 'wevm/zyzz'
  console.log(
    `Baseline: [main @ ${commit.slice(0, 7)}](https://github.com/${repository}/commit/${commit})\n`,
  )
  console.log(
    '🟢 Improved · 🟡 Within tolerance / unchanged · 🔴 Regression above threshold\n',
  )
  console.log(
    `CI fails for increases above ${thresholds.ms}% in time or ${thresholds.B}% in gzip size. Timing changes must also exceed the sum of both reported errors. Zyzz measurements only; timings come from separate CI runners.\n`,
  )
  console.log('| Benchmark | Main | PR / current | Change |')
  console.log('| --- | ---: | ---: | ---: |')

  const previous = read(baseline)
  const current = read(candidate)
  const regressions: string[] = []
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
    const tolerance =
      after.unit === 'ms'
        ? Math.max(thresholds.ms, before.error + after.error)
        : thresholds.B
    const significant =
      percent === undefined ? delta !== 0 : Math.abs(percent) > tolerance
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
    if (significant && delta > 0) regressions.push(`${name}: ${bytes}${change}`)
  }
  console.log('')
  if (check === '--check' && regressions.length > 0) {
    console.error(`Benchmark regressions:\n${regressions.join('\n')}`)
    process.exitCode = 1
  }
}

function format(measurement: Measurement) {
  return `${measurement.unit === 'B' ? measurement.value : Number(measurement.value.toPrecision(4))} ${measurement.unit}`
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
  if (!input.trim() || !Number.isFinite(value) || value < 0)
    throw new Error(`${name} must be a finite, nonnegative percentage`)
  return value
}
