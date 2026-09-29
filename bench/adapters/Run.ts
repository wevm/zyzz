/** Runs sequential fresh-process samples and records reproducible adapter results. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Os from 'node:os'
import * as Crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'
const exec = promisify(ChildProcess.execFile)
const samples = Number(process.env.ADAPTER_SAMPLES ?? 3)
const components = Number(process.env.ADAPTER_COMPONENTS ?? 96)
if (
  !Number.isInteger(samples) ||
  samples < 1 ||
  !Number.isInteger(components) ||
  components < 1
)
  throw Error('Positive integer samples and components required')
const lanes = [
  'api',
  'host',
  'cli',
  'esbuild',
  'rollup',
  'webpack',
  'vite',
  'browser-vite',
  'browser-next',
  'browser-next-webpack',
]
const selected = process.env.ADAPTER_LANES?.split(',') ?? lanes
if(selected.some(lane=>!lanes.includes(lane)) || new Set(selected).size!==selected.length)throw Error('Unknown or duplicate adapter lane')
const results: Record<
  string,
  Array<{ timings: Record<string, number> }>
> = {}
const revision = (await exec('git', ['rev-parse', 'HEAD'])).stdout.trim()
const output = process.env.ADAPTER_OUTPUT ?? 'bench/results/adapters.json'
await Fs.mkdir('bench/results', { recursive: true })
const require = createRequire(import.meta.url)
const digest = async (file: string) =>
  Crypto.hash('sha256', await Fs.readFile(file))
const report = {
  revision,
  lockfile: await digest('pnpm-lock.yaml'),
  fixture: await digest('bench/adapters/Corpus.ts'),
  implementation: await digest('dist/vite/index.js'),
  versions: Object.fromEntries(
    await Promise.all(
      ['vite', 'next', 'webpack', 'rollup', 'esbuild'].map(async (name) => [
        name,
        JSON.parse(
          await Fs.readFile(require.resolve(name + '/package.json'), 'utf8'),
        ).version,
      ]),
    ),
  ),
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  cpus: Os.cpus()[0]?.model,
  memory: Os.totalmem(),
  samples,
  components,
  results,
}
await Fs.writeFile(output, JSON.stringify(report, null, 2) + '\n')
for (let sample = 0; sample < samples; sample++)
  for (const lane of selected) {
    const browser = lane.startsWith('browser-')
    const { stdout } = await exec(
      process.execPath,
      [
        browser ? 'bench/adapters/Browser.ts' : 'bench/adapters/Worker.ts',
        browser ? lane.slice(8) : lane,
      ],
      {
        timeout: 300_000,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, ADAPTER_COMPONENTS: String(components) },
      },
    )
    const result = JSON.parse(stdout)
    ;(results[lane] ??= []).push(result)
    await Fs.writeFile(output, JSON.stringify(report, null, 2) + '\n')
    process.stdout.write(
      `${lane} sample ${sample + 1}: ${JSON.stringify(result.timings)}\n`,
    )
  }
let markdown =
  '| Integration | Operation | Median (ms) | Min (ms) | Max (ms) | Samples |\n| --- | --- | ---: | ---: | ---: | ---: |\n'
for (const [lane, runs] of Object.entries(results))
  for (const operation of Object.keys(runs[0]!.timings)) {
    const values = runs.map((x) => x.timings[operation]!).sort((a, b) => a - b)
    const middle = Math.floor(values.length / 2)
    const median =
      values.length % 2
        ? values[middle]!
        : (values[middle - 1]! + values[middle]!) / 2
    markdown += `| ${lane} | ${operation} | ${median.toFixed(1)} | ${values[0]!.toFixed(1)} | ${values.at(-1)!.toFixed(1)} | ${values.length} |\n`
  }
await Fs.writeFile(output.replace(/\.json$/, '.md'), markdown)
if (process.env.GITHUB_STEP_SUMMARY)
  await Fs.appendFile(process.env.GITHUB_STEP_SUMMARY, markdown)
