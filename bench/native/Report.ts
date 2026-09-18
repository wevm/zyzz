/** Validates complete render lanes and summarizes raw native layout samples. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Corpus from './Corpus.js'

const platform = process.argv[2]
if (platform !== 'ios' && platform !== 'android')
  throw new Error('Expected ios or android')
const directory = Path.resolve('bench/results/native', platform)
const result = JSON.parse(
  await Fs.readFile(Path.join(directory, 'render.json'), 'utf8'),
) as {
  samples: {
    library: Corpus.Library
    kind: Corpus.Kind
    count: number
    operation: string
    pass: number
    iteration: number
    milliseconds: number
  }[]
}
const lines = [
  `## Native renders: ${platform}`,
  '',
  'Request to all validated native layout events. Includes React scheduling, Fabric/Yoga layout, and event delivery; excludes GPU presentation. Times are informational.',
  '',
  '| Library | Workload | Nodes | Operation | Pass | Samples | Median ms | p95 ms | CV % |',
  '| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |',
]
let expected = 0
for (const library of Corpus.libraries)
  for (const kind of Corpus.kinds)
    for (const count of Corpus.counts)
      for (const operation of kind === 'repeated' || kind === 'unique'
        ? ['mount', 'remount']
        : ['mount', 'update', 'remount'])
        for (const pass of [1, 2]) {
          const group = result.samples.filter(
            (s) =>
              s.library === library &&
              s.kind === kind &&
              s.count === count &&
              s.operation === operation &&
              s.pass === pass,
          )
          if (
            group.length !== 20 ||
            new Set(group.map((s) => s.iteration)).size !== 20 ||
            group.some(
              (s) =>
                s.iteration < 0 ||
                s.iteration >= 20 ||
                !Number.isFinite(s.milliseconds) ||
                s.milliseconds <= 0,
            )
          )
            throw new Error(
              `Missing or invalid samples: ${library}/${kind}/${count}/${operation}/${pass}`,
            )
          expected += 20
          const values = group.map((s) => s.milliseconds).sort((a, b) => a - b)
          const mean = values.reduce((a, b) => a + b, 0) / values.length
          const variance =
            values.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
            (values.length - 1)
          lines.push(
            `| ${library} | ${kind} | ${count} | ${operation} | ${pass} | ${values.length} | ${((values[9]! + values[10]!) / 2).toFixed(3)} | ${values[18]!.toFixed(3)} | ${((Math.sqrt(variance) / mean) * 100).toFixed(1)} |`,
          )
        }
if (result.samples.length !== expected)
  throw new Error('Unexpected native samples')
await Fs.writeFile(Path.join(directory, 'report.md'), lines.join('\n') + '\n')
console.log(lines.join('\n'))
