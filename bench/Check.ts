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
  readonly css: { readonly gzip: number }
  readonly javascript: { readonly gzip: number }
  readonly library: string
  readonly total: { readonly gzip: number }
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

console.log('## Framework Gate\n')
console.log(
  'Zyzz must beat every alternative on mean build time and total gzip (CSS + required JavaScript). Ties and missing measurements fail. Timing errors remain visible in the full report.\n',
)
console.log('| Workload | Zyzz lane | Alternative | Build time | Total gzip |')
console.log('| --- | --- | --- | --- | --- |')

for (const workload of workloads) {
  try {
    const matches = groups.filter(
      (group) =>
        group.fullName === workload.group ||
        group.fullName.endsWith(` > ${workload.group}`),
    )
    if (matches.length !== 1)
      throw new Error('Expected exactly one timing group.')
    const measurements = new Map<string, { mean: number; size: number }>()
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
      measurements.set(library, { mean: timing.mean!, size: size.total.gzip })
    }
    for (const lane of workload.lanes) {
      const zyzz = measurements.get(lane)!
      for (const library of competitors) {
        const other = measurements.get(library)!
        const faster = zyzz.mean < other.mean
        const smaller = zyzz.size < other.size
        if (!faster || !smaller) process.exitCode = 1
        console.log(
          `| ${workload.directory} | ${lane} | ${library} | ${faster ? '🟢' : '🔴'} ${zyzz.mean.toFixed(3)} / ${other.mean.toFixed(3)} ms | ${smaller ? '🟢' : '🔴'} ${zyzz.size} / ${other.size} B |`,
        )
      }
    }
  } catch (error) {
    process.exitCode = 1
    console.log(
      `| ${workload.directory} | — | — | 🔴 Missing or invalid measurements | — |`,
    )
    console.error(`${workload.directory}:`, error)
  }
}
