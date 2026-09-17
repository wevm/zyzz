/** Rejects missing compiler lanes and publishes their means and sampling error. @module */
import * as Fs from 'node:fs/promises'

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
  '## Native compilation',
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
      const key = `${group.fullName}/${benchmark.name}`
      if (
        lanes.has(key) ||
        !['stylesheet', 'unistyles', 'zyzz'].includes(benchmark.name) ||
        !Number.isFinite(benchmark.mean) ||
        benchmark.mean <= 0 ||
        !Number.isFinite(benchmark.rme) ||
        benchmark.sampleCount < 10
      )
        throw new Error(`Invalid native compiler lane: ${key}`)
      lanes.add(key)
      rows.push(
        `| ${group.fullName} | ${benchmark.name} | ${benchmark.mean.toFixed(3)} | ${benchmark.rme.toFixed(1)} | ${benchmark.sampleCount} |`,
      )
    }
if (lanes.size !== 270)
  throw new Error(`Expected 270 compiler lanes, received ${lanes.size}`)
await Fs.writeFile(`${root}/compile-report.md`, rows.join('\n') + '\n')
console.log(rows.join('\n'))
