/** Rejects missing compiler lanes and publishes their means and sampling error. @module */
import * as Fs from 'node:fs/promises'

const platform = process.argv[2]
const count = Number(process.argv[3])
const kind = process.argv[4] ?? 'all'
if (
  !['ios', 'android'].includes(platform ?? '') ||
  ![10, 100, 1000].includes(count) ||
  !['all', 'unique'].includes(kind)
)
  throw new Error(
    'Usage: CompileReport.mjs ios|android 10|100|1000 [all|unique]',
  )

const expected = new Set<string>()
for (const workload of kind === 'all'
  ? ['repeated', 'unique', 'dynamic', 'variants', 'theme']
  : [kind])
  for (const mode of ['cold process', 'warm module', 'edited module'])
    for (const library of ['stylesheet', 'unistyles', 'zyzz'])
      expected.add(
        `${mode === 'cold process' ? 'native cold process' : 'native'} ${platform} / ${workload} / ${count}${mode === 'cold process' ? '' : ` / ${mode}`}/${library}`,
      )

const root = 'bench/results/native'
const data = JSON.parse(
  await Fs.readFile(`${root}/compile-timings.json`, 'utf8'),
) as {
  files: {
    groups: {
      fullName: string
      benchmarks: {
        name: string
        mean: number
        rme: number
        sampleCount: number
      }[]
    }[]
  }[]
}
const rows = [
  `## Native compilation: ${platform}, ${count} definitions`,
  '',
  'Cold process includes startup. Warm and edited lanes measure complete module transforms without Metro caching. Timing differences are informational.',
  '',
  '| Workload | Library | Mean ms | Error % | Samples |',
  '| --- | --- | ---: | ---: | ---: |',
]
const lanes = new Set<string>()
for (const file of data.files)
  for (const group of file.groups)
    for (const benchmark of group.benchmarks) {
      if (!group.fullName.includes('native ')) continue
      const name = group.fullName.slice(group.fullName.indexOf('native '))
      const key = `${name}/${benchmark.name}`
      if (
        lanes.has(key) ||
        !expected.has(key) ||
        !Number.isFinite(benchmark.mean) ||
        benchmark.mean <= 0 ||
        !Number.isFinite(benchmark.rme) ||
        !Number.isInteger(benchmark.sampleCount) ||
        benchmark.sampleCount < 10
      )
        throw new Error(`Invalid native compiler lane: ${key}`)
      lanes.add(key)
      rows.push(
        `| ${group.fullName} | ${benchmark.name} | ${benchmark.mean.toFixed(3)} | ${benchmark.rme.toFixed(1)} | ${benchmark.sampleCount} |`,
      )
    }
if (lanes.size !== expected.size)
  throw new Error(
    `Expected ${expected.size} compiler lanes, received ${lanes.size}`,
  )
await Fs.writeFile(`${root}/compile-report.md`, rows.join('\n') + '\n')
console.log(rows.join('\n'))
