/**
 * Compares Zyzz commit + layout render medians with a same-runner base run and
 * enforces an opt-in regression threshold.
 * @module
 */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import type * as Render from './Render.js'
import type * as RenderFixture from './RenderFixture.js'

const [directory = 'bench/results', baseDirectory] = process.argv.slice(2)
const base = baseDirectory ?? Path.join(directory, 'render-base')
const input = process.env.BENCH_RENDER_THRESHOLD
const enforced = input !== undefined
const operations = ['mount', 'update', 'remount'] as const
// Five idle sequential runs spread Zyzz commit + layout medians by at most
// 16.5%; the default keeps a margin above that drift.
const threshold = (() => {
  if (input === undefined) return 130

  const value = Number(input)
  if (!input.trim() || !Number.isFinite(value) || value < 100)
    throw new Error(
      'BENCH_RENDER_THRESHOLD must be a finite percentage ratio of at least 100',
    )

  return value
})()

const candidate = await read(Path.join(directory, 'render-timings.json'))
const previous = await read(Path.join(base, 'render-timings.json'))
const commit = await Fs.readFile(Path.join(base, 'commit.txt'), 'utf8').then(
  (text) => text.trim(),
  () => '',
)
console.log('## Zyzz Render Regression Check\n')
console.log(
  `Base${commit ? ` \`${commit.slice(0, 7)}\`` : ''} measured first with the candidate harness on the same runner. Values are the mean of both pass medians for commit + layout, in milliseconds. ${enforced ? `Changes above +${threshold - 100}% fail this check.` : `Changes above +${threshold - 100}% are marked; set \`BENCH_RENDER_THRESHOLD\` to enforce the check.`} One run of each revision cannot separate a change of that size from runner drift unless repeated runs confirm it.\n`,
)
console.log(
  '| Cards | Workload | Operation | Base ms | Candidate ms | Change |',
)
console.log('| ---: | --- | --- | ---: | ---: | ---: |')
for (const components of [100, 1000])
  for (const kind of ['callable', 'overrides', 'dynamic'] as const)
    for (const operation of operations) {
      const before = value(previous, { components, kind, operation })
      const after = value(candidate, { components, kind, operation })
      const ratio = after / before
      const tolerance = threshold / 100
      // Rounding first keeps tiny negative differences from printing as -0.0%.
      const percent = Number(((ratio - 1) * 100).toFixed(1)) || 0

      const light = (() => {
        if (ratio > tolerance) {
          if (enforced) process.exitCode = 1

          return '🔴'
        }
        if (ratio < 2 - tolerance) return '🟢'

        return '🟡'
      })()

      console.log(
        `| ${components} | ${kind} | ${operation} | ${before.toFixed(2)} | ${after.toFixed(2)} | ${light} ${percent > 0 ? '+' : ''}${percent.toFixed(1)}% |`,
      )
    }

const outcome = (() => {
  if (process.exitCode === 1)
    return '🔴 Zyzz render regression above the enforced threshold.'
  if (enforced)
    return '🟢 No Zyzz render regression above the enforced threshold.'

  return 'Advisory only; no threshold enforced.'
})()
console.log(`\n${outcome}\n`)

/** Loads the Zyzz groups of one complete browser run. */
async function read(path: string): Promise<readonly Render.Group[]> {
  const data = JSON.parse(await Fs.readFile(path, 'utf8')) as {
    groups: readonly Render.Group[]
  }

  const groups = data.groups.filter((group) => group.library === 'zyzz')

  for (const components of [100, 1000])
    for (const kind of ['callable', 'overrides', 'dynamic'])
      for (const pass of [1, 2]) {
        const matches = groups.filter(
          (group) =>
            group.components === components &&
            group.count === components / 10 &&
            group.kind === kind &&
            group.pass === pass,
        )
        if (matches.length !== 1)
          throw new Error(
            `${path}: missing or duplicate Zyzz group ${components}/${kind}/${pass}`,
          )

        for (const operation of operations) {
          const samples = matches[0]!.samples.filter(
            (sample) => sample.operation === operation,
          )
          if (
            samples.length !== 20 ||
            samples.some(
              (sample) =>
                !Number.isFinite(sample.commitLayout) ||
                sample.commitLayout < 0,
            )
          )
            throw new Error(
              `${path}: invalid ${operation} samples in ${components}/${kind}/${pass}`,
            )
        }
      }

  return groups
}

/** Returns the mean of both pass medians for commit + layout. */
function value(
  groups: readonly Render.Group[],
  options: value.Options,
): number {
  const passes = groups.filter(
    (group) =>
      group.components === options.components && group.kind === options.kind,
  )

  const medians = passes.map((group) => {
    const sorted = group.samples
      .filter((sample) => sample.operation === options.operation)
      .map((sample) => sample.commitLayout)
      .sort((a, b) => a - b)

    return sorted[Math.ceil(sorted.length / 2) - 1]!
  })

  return medians.reduce((sum, item) => sum + item, 0) / medians.length
}

/** Selects one Zyzz workload operation across both passes. */
declare namespace value {
  /** Workload and tree operation. */
  type Options = {
    /** Rendered card count. */
    components: number
    /** Workload implemented by the React fixture. */
    kind: Render.Group['kind']
    /** Tree operation. */
    operation: RenderFixture.Sample['operation']
  }
}
