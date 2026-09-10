/**
 * Reports component timings and validates complete production browser runs.
 * @module
 */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import type * as Render from './Render.js'

const directory = process.argv[2] ?? 'bench/results'
const data = JSON.parse(
  await Fs.readFile(Path.join(directory, 'render-timings.json'), 'utf8'),
) as { groups: Render.Group[]; userAgent: string }
console.log('## Production React Render Performance\n')
console.log(
  'Fresh-root mount, retained-DOM update, and remount after untimed removal. Production React 19.2.4; styles and JavaScript are loaded before timing. Three warmup cycles, twenty measured cycles per pass, reversed framework order on pass two.\n',
)
console.log(
  'Commit includes scheduling, React rendering, and DOM commit through a layout effect. Commit + layout adds a forced geometry read. Frame is a two-animation-frame checkpoint, including refresh wait; it is not paint CPU duration. These are warm-code client operations, not navigation or hydration.\n',
)
console.log(`Browser: ${data.userAgent}\n`)
console.log(
  '| Cards | Workload | Framework | Operation | Pass | Commit median ms | Commit + layout median ms | p95 ms | Frame median ms |',
)
console.log('| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |')
let expected = 0
for (const components of [100, 1000])
  for (const kind of ['callable', 'overrides', 'dynamic'])
    for (const library of kind === 'dynamic'
      ? ['baseline', 'zyzz']
      : ['baseline', 'panda', 'stylex', 'tailwind', 'vanilla-extract', 'zyzz'])
      for (const pass of [1, 2]) {
        expected++
        const matches = data.groups.filter(
          (group) =>
            group.components === components &&
            group.count === components / 10 &&
            group.kind === kind &&
            group.library === library &&
            group.pass === pass,
        )
        if (matches.length !== 1)
          throw new Error(
            `Missing or duplicate group: ${components}/${kind}/${library}/${pass}`,
          )
        const group = matches[0]!
        if (group.samples.length !== 60) throw new Error('Incomplete samples')
        for (const operation of ['mount', 'update', 'remount']) {
          const samples = group.samples.filter(
            (sample) => sample.operation === operation,
          )
          if (
            samples.length !== 20 ||
            samples.some(
              (sample) =>
                ![sample.commit, sample.commitLayout, sample.frame].every(
                  (value) => Number.isFinite(value) && value >= 0,
                ) ||
                sample.commitLayout < sample.commit ||
                sample.frame < sample.commitLayout,
            )
          )
            throw new Error('Invalid operation samples')
          const quantile = (
            key: 'commit' | 'commitLayout' | 'frame',
            fraction: number,
          ) =>
            [...samples]
              .sort((a, b) => a[key] - b[key])
              [Math.ceil(samples.length * fraction) - 1]![key].toFixed(2)
          console.log(
            `| ${components} | ${kind} | ${library} | ${operation} | ${pass} | ${quantile('commit', 0.5)} | ${quantile('commitLayout', 0.5)} | ${quantile('commitLayout', 0.95)} | ${quantile('frame', 0.5)} |`,
          )
        }
      }
if (data.groups.length !== expected) throw new Error('Unexpected groups')
console.log(
  '\nPerformance comparisons are advisory while repeatability is established. Missing measurements and browser correctness failures fail CI. Dynamic slots compare only Zyzz and native CSS; no dynamic ranking of other frameworks is implied. Function microbenchmarks are separate diagnostics.\n',
)

const basePath = Path.join(directory, 'render-base', 'render-timings.json')
if (
  await Fs.access(basePath).then(
    () => true,
    () => false,
  )
) {
  const base = JSON.parse(await Fs.readFile(basePath, 'utf8')) as {
    groups: Render.Group[]
  }
  console.log('### Zyzz Base Comparison\n')
  console.log(
    'Same runner and candidate harness; base runs first. Sequential order remains a source of drift. Values are commit + layout medians in milliseconds, not isolated styling costs.\n',
  )
  console.log(
    '| Cards | Workload | Operation | Pass | Base ms | Candidate ms | Change |',
  )
  console.log('| ---: | --- | --- | ---: | ---: | ---: | ---: |')
  for (const group of data.groups.filter((group) => group.library === 'zyzz')) {
    const before = base.groups.find(
      (item) =>
        item.library === 'zyzz' &&
        item.components === group.components &&
        item.kind === group.kind &&
        item.pass === group.pass,
    )
    if (!before) throw new Error('Missing base render group')
    for (const operation of ['mount', 'update', 'remount']) {
      const median = (samples: Render.Group['samples']) => {
        const values = samples
          .filter((sample) => sample.operation === operation)
          .map((sample) => sample.commitLayout)
          .sort((a, b) => a - b)
        if (
          values.length !== 20 ||
          values.some((value) => !Number.isFinite(value) || value < 0)
        )
          throw new Error('Invalid base samples')
        return values[9]!
      }
      const oldValue = median(before.samples)
      const newValue = median(group.samples)
      console.log(
        `| ${group.components} | ${group.kind} | ${operation} | ${group.pass} | ${oldValue.toFixed(2)} | ${newValue.toFixed(2)} | ${oldValue ? ((newValue / oldValue - 1) * 100).toFixed(1) + '%' : 'n/a'} |`,
      )
    }
  }
}
