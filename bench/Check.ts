/**
 * Gates matched compiler workloads on build time and total gzip delivery.
 * @module
 */
import * as Fs from 'node:fs'
import * as Path from 'node:path'

type Report = {
  readonly files: readonly {
    readonly groups: readonly {
      readonly benchmarks: readonly Timing[]
      readonly fullName: string
    }[]
  }[]
}

type Sizes = {
  readonly css: {
    readonly brotli?: number
    readonly gzip: number
    readonly raw?: number
  }
  readonly javascript: {
    readonly brotli?: number
    readonly gzip: number
    readonly raw?: number
  }
  readonly library: string
  readonly total: {
    readonly brotli?: number
    readonly gzip: number
    readonly raw?: number
  }
}

type Timing = {
  readonly mean?: number
  readonly name: string
  readonly rme?: number
  readonly sampleCount?: number
}

const directory = process.argv[2]
if (!directory) throw new Error('Usage: node bench/Check.ts <results>')
const report: Report = JSON.parse(
  Fs.readFileSync(Path.join(directory, 'timings.json'), 'utf8'),
)
const groups = report.files.flatMap((file) => file.groups)
const competitors = ['panda', 'stylex', 'tailwind', 'vanilla-extract']
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
  ...[10, 100].map((count) => ({
    directory: `theme-comparison/${count}`,
    group: `theme comparison / ${count} styles`,
    lanes: ['zyzz', 'zyzz-tokens'],
  })),
]

const names: Record<string, string> = {
  panda: 'Panda CSS',
  stylex: 'StyleX',
  tailwind: 'Tailwind',
  'vanilla-extract': 'vanilla-extract',
  zyzz: 'Zyzz',
  'zyzz-tokens': 'Zyzz (token resolution included)',
}
const titles: Record<string, string> = {
  small: '3 Components',
  repeated: '1,000 Components — Repeated Styles',
  unique: '1,000 Components — Unique Padding',
  partial: '100 Components — Partial Sharing',
  palette: '100 Components — Reused Palette',
  independent: '100 Components — Independent Values',
  sparse: '100 Components — Sparse Properties',
  components: '60 Components — Mixed Shapes',
  'theme-comparison/10': 'Themes — 10 Components',
  'theme-comparison/100': 'Themes — 100 Components',
}

console.log('## Framework Comparisons\n')
console.log(
  '🟢 Zyzz beats every other framework · 🔴 Zyzz does not beat every other framework. Both build time and total gzip must pass; ties fail. Total gzip includes CSS + required JavaScript.\n',
)
console.log(
  'Literal workloads use prepared inputs; theme workloads include two scopes and light/dark values. Zyzz starts from validated definitions; the second theme result includes token resolution. Source parsing is measured separately. See bench/README.md for each compiler’s measurement boundary.\n',
)

for (const workload of workloads) {
  console.log(`### ${titles[workload.directory]}\n`)
  try {
    const matches = groups.filter(
      (group) =>
        group.fullName === workload.group ||
        group.fullName.endsWith(` > ${workload.group}`),
    )
    if (matches.length !== 1)
      throw new Error('Expected exactly one timing group.')
    const measurements = new Map<
      string,
      { mean: number; size: number; sizes: Sizes; timing: Timing }
    >()
    for (const library of [...workload.lanes, ...competitors]) {
      const timings = matches[0]!.benchmarks.filter(
        (entry) => entry.name === library,
      )
      const timing = timings[0]
      if (
        timings.length !== 1 ||
        !timing ||
        !Number.isFinite(timing.mean) ||
        timing.mean! <= 0 ||
        !Number.isFinite(timing.rme) ||
        timing.rme! < 0 ||
        !Number.isInteger(timing.sampleCount) ||
        timing.sampleCount! < 1
      )
        throw new Error(`Missing or invalid timing: ${library}.`)
      const size: Sizes = JSON.parse(
        Fs.readFileSync(
          Path.join(directory, workload.directory, `${library}.json`),
          'utf8',
        ),
      )
      if (
        size.library !== library ||
        !Number.isSafeInteger(size.css?.gzip) ||
        size.css.gzip < 0 ||
        !Number.isSafeInteger(size.javascript?.gzip) ||
        size.javascript.gzip < 0 ||
        !Number.isSafeInteger(size.total?.gzip) ||
        size.total.gzip <= 0 ||
        size.total.gzip !== size.css.gzip + size.javascript.gzip
      )
        throw new Error(`Missing or invalid size: ${library}.`)
      measurements.set(library, {
        mean: timing.mean!,
        size: size.total.gzip,
        sizes: size,
        timing,
      })
    }
    console.log('| Framework | Build (ms) | CSS gzip | JS gzip | Total gzip |')
    console.log('| --- | ---: | ---: | ---: | ---: |')
    for (const [library, result] of measurements) {
      const status = (() => {
        if (!workload.lanes.includes(library)) return { speed: '', size: '' }
        const faster = competitors.every(
          (name) => result.mean < measurements.get(name)!.mean,
        )
        const smaller = competitors.every(
          (name) => result.size < measurements.get(name)!.size,
        )
        if (!faster || !smaller) process.exitCode = 1
        return { speed: faster ? '🟢 ' : '🔴 ', size: smaller ? '🟢 ' : '🔴 ' }
      })()
      console.log(
        `| ${names[library]} | ${status.speed}${result.mean.toFixed(3)} | ${result.sizes.css.gzip} B | ${result.sizes.javascript.gzip} B | ${status.size}${result.size} B |`,
      )
    }
    console.log('\n<details>\n<summary>Full Measurements</summary>\n')
    console.log(
      '| Framework | Error (±%) | Samples | CSS raw | CSS Brotli | JS raw | JS Brotli | Total raw | Total Brotli |',
    )
    console.log(
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    )
    for (const [library, result] of measurements) {
      const { sizes, timing } = result
      console.log(
        `| ${names[library]} | ${timing.rme!.toFixed(2)} | ${timing.sampleCount} | ${sizes.css.raw ?? '—'} | ${sizes.css.brotli ?? '—'} | ${sizes.javascript.raw ?? '—'} | ${sizes.javascript.brotli ?? '—'} | ${sizes.total.raw ?? '—'} | ${sizes.total.brotli ?? '—'} |`,
      )
    }
    console.log('\n</details>\n')
  } catch (error) {
    process.exitCode = 1
    console.log('🔴 Missing or invalid measurements. See workflow logs.\n')
    console.error(`${workload.directory}:`, error)
  }
}
