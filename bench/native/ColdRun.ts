/** Relaunches the prepared iOS release app once per sample and summarizes single-lane cold starts. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Http from 'node:http'
import * as Path from 'node:path'
import * as Corpus from './Corpus.js'

const device = process.argv[2]
if (!device) throw new Error('Usage: node ColdRun.mjs SIMULATOR_UDID')
const application = 'dev.zyzz.nativebench'
const kinds = ['repeated', 'unique', 'theme'] as const
const lanes = Corpus.libraries.flatMap((library) =>
  kinds.map((kind) => `${library}/${kind}/1000`),
)

type Sample = {
  iteration: number
  lane: string
  milliseconds: number
}

let pending: ((sample: Omit<Sample, 'iteration'>) => void) | undefined
const server = Http.createServer(async (request, response) => {
  let body = ''
  for await (const chunk of request) body += chunk
  if (request.method !== 'POST' || request.url !== '/cold') {
    response.writeHead(404).end()
    return
  }
  response.writeHead(200).end('saved')
  pending?.(JSON.parse(body))
})
await new Promise<void>((resolve) => server.listen(8765, '127.0.0.1', resolve))

const samples: Sample[] = []
try {
  for (let iteration = -2; iteration < 20; iteration++)
    // Rotating the lane order spreads simulator drift across libraries.
    for (const lane of [
      ...lanes.slice(iteration % lanes.length),
      ...lanes.slice(0, iteration % lanes.length),
    ]) {
      ChildProcess.spawnSync('xcrun', [
        'simctl',
        'terminate',
        device,
        application,
      ])
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const result = new Promise<Omit<Sample, 'iteration'>>(
        (resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error(`Cold start timeout: ${lane}`)),
            30_000,
          )
          pending = (sample) => {
            clearTimeout(timeout)
            resolve(sample)
          }
        },
      )
      ChildProcess.execFileSync('xcrun', [
        'simctl',
        'launch',
        device,
        application,
        '-benchCold',
        lane,
      ])
      const sample = await result
      if (sample.lane !== lane)
        throw new Error(`Unexpected lane ${sample.lane}`)
      if (iteration >= 0) samples.push({ ...sample, iteration })
      console.log(`${lane} ${iteration} ${sample.milliseconds.toFixed(1)}`)
    }
} finally {
  ChildProcess.spawnSync('xcrun', ['simctl', 'terminate', device, application])
  server.close()
}

const directory = Path.resolve('bench/results/native/ios')
await Fs.mkdir(directory, { recursive: true })
await Fs.writeFile(
  Path.join(directory, 'cold.json'),
  JSON.stringify({ samples, schema: 1 }, null, 2),
)
const lines = [
  '## Native cold starts: ios',
  '',
  'Fresh process per sample, loading only the measured lane. JavaScript bundle execution to all 1,000 native layout events. Times are informational.',
  '',
  '| Library | Workload | Samples | Median ms | p95 ms | CV % |',
  '| --- | --- | ---: | ---: | ---: | ---: |',
]
for (const lane of lanes) {
  const [library, kind] = lane.split('/')
  const group = samples.filter((sample) => sample.lane === lane)
  const values = group
    .map((sample) => sample.milliseconds)
    .sort((a, b) => a - b)
  if (values.length !== 20 || values.some((value) => !Number.isFinite(value)))
    throw new Error(`Missing or invalid cold samples: ${lane}`)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (values.length - 1)
  lines.push(
    `| ${library} | ${kind} | ${values.length} | ${((values[9]! + values[10]!) / 2).toFixed(1)} | ${values[18]!.toFixed(1)} | ${((Math.sqrt(variance) / mean) * 100).toFixed(1)} |`,
  )
}
await Fs.writeFile(Path.join(directory, 'cold.md'), lines.join('\n') + '\n')
console.log(lines.join('\n'))
