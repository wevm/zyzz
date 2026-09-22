/** Summarizes paired-runner adapter medians without imposing uncalibrated timing gates. @module */
import * as Fs from 'node:fs/promises'
type Report = {
  fixture: string
  components: number
  samples: number
  node: string
  results: Record<string, { timings: Record<string, number> }[]>
}
const baseline = JSON.parse(
  await Fs.readFile(process.argv[2]!, 'utf8'),
) as Report
const candidate = JSON.parse(
  await Fs.readFile(process.argv[3]!, 'utf8'),
) as Report
if (
  baseline.fixture !== candidate.fixture ||
  baseline.components !== candidate.components ||
  baseline.node !== candidate.node ||
  baseline.samples !== candidate.samples
)
  throw Error('Incompatible benchmark environments')
function median(values: number[]) {
  values.sort((a, b) => a - b)
  const i = Math.floor(values.length / 2)
  return values.length % 2 ? values[i]! : (values[i - 1]! + values[i]!) / 2
}
let markdown =
  '## Adapter comparison\n\nSame-runner medians. Timing changes are informational until CI variance is established.\n\n| Integration | Operation | Baseline (ms) | Candidate (ms) | Change |\n| --- | --- | ---: | ---: | ---: |\n'
for (const [lane, runs] of Object.entries(candidate.results)) {
  const previous = baseline.results[lane]
  if (!previous) continue
  for (const operation of Object.keys(runs[0]!.timings)) {
    const before = median(previous.map((x) => x.timings[operation]!))
    const after = median(runs.map((x) => x.timings[operation]!))
    if (!Number.isFinite(before) || !Number.isFinite(after))
      throw Error('Missing timing')
    markdown += `| ${lane} | ${operation} | ${before.toFixed(1)} | ${after.toFixed(1)} | ${((after / before - 1) * 100).toFixed(1)}% |\n`
  }
}
await Fs.writeFile('bench/results/adapter-comparison.md', markdown)
if (process.env.GITHUB_STEP_SUMMARY)
  await Fs.appendFile(process.env.GITHUB_STEP_SUMMARY, markdown)
process.stdout.write(markdown)
