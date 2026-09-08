/**
 * Converts saved benchmark artifacts to github-action-benchmark input.
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
