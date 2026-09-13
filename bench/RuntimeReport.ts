/**
 * Reports diagnostic function timings; these do not establish render performance.
 * @module
 */
import * as Fs from 'node:fs'
import * as Path from 'node:path'

type Timing = {
  mean: number
  name: string
  rme: number
  sampleCount: number
}

type Report = {
  files: readonly {
    groups: readonly { benchmarks: readonly Timing[]; fullName: string }[]
  }[]
}

const directory = process.argv[2]
if (!directory) throw new Error('Usage: node bench/RuntimeReport.ts <results>')
const report: Report = JSON.parse(
  Fs.readFileSync(Path.join(directory, 'browser-timings.json'), 'utf8'),
)
const groups = report.files.flatMap((file) => file.groups)
const frameworks = [
  'baseline',
  'panda',
  'stylex',
  'tailwind',
  'vanilla-extract',
  'zyzz',
]
const names: Record<string, string> = {
  baseline: 'Plain class/style',
  panda: 'Panda CSS',
  stylex: 'StyleX',
  tailwind: 'Tailwind',
  'vanilla-extract': 'vanilla-extract',
  zyzz: 'Zyzz',
}

console.log('## Runtime Framework Comparisons\n')
console.log(
  'Summaries rank the average of the two pass means, including the native control; ratios compare the runner-up. Observed leads are not significance claims.\n',
)
console.log(
  'Chromium production props application only; no compilation, DOM or React rendering in timings. Both passes execute inside Chromium on this runner with reversed framework order. Cached props are distinct from surviving calls.\n',
)
console.log(
  '🟢 Zyzz faster beyond reported uncertainty in both passes · 🔴 competitor faster in both passes · 🟡 inconclusive or overlapping uncertainty. Plain class/style is an informational control. No claim of a universal speed advantage follows from a tie.\n',
)

for (const count of [10, 100])
  for (const kind of [
    'cached',
    'direct',
    'callable',
    'overrides',
    'dynamic',
    'variants',
  ]) {
    const libraries =
      kind === 'dynamic'
        ? ['baseline', 'zyzz']
        : kind === 'variants'
          ? ['baseline', 'panda', 'stylex', 'zyzz']
          : frameworks

    try {
      const passes = [1, 2].map((repeat) => {
        const name = `runtime comparison / ${count} styles / ${kind} / repeat ${repeat}`
        const matches = groups.filter(
          (group) =>
            group.fullName === name || group.fullName.endsWith(` > ${name}`),
        )
        if (matches.length !== 1)
          throw new Error(`Missing or duplicate group: ${name}`)

        return new Map(
          libraries.map((library) => {
            const entries = matches[0]!.benchmarks.filter(
              (entry) => entry.name === library,
            )
            const timing = entries[0]
            if (
              entries.length !== 1 ||
              !timing ||
              !Number.isFinite(timing.mean) ||
              timing.mean <= 0 ||
              !Number.isFinite(timing.rme) ||
              timing.rme < 0 ||
              !Number.isInteger(timing.sampleCount) ||
              timing.sampleCount < 100
            )
              throw new Error(`Invalid timing: ${name} / ${library}`)

            return [library, timing] as const
          }),
        )
      })

      const faster = (a: Timing, b: Timing) =>
        a.mean * (1 + a.rme / 100) < b.mean * (1 - b.rme / 100)

      const losses = libraries.filter(
        (library) =>
          library !== 'baseline' &&
          library !== 'zyzz' &&
          passes.every((pass) => faster(pass.get(library)!, pass.get('zyzz')!)),
      )

      const wins = libraries
        .filter((library) => library !== 'baseline' && library !== 'zyzz')
        .every((library) =>
          passes.every((pass) => faster(pass.get('zyzz')!, pass.get(library)!)),
        )

      const summary = winner({
        decimals: 1,
        measurements: libraries.map((library) => ({
          name: names[library]!,
          value:
            (passes.reduce((sum, pass) => sum + pass.get(library)!.mean, 0) /
              passes.length) *
            1e6,
        })),
        unit: 'ns',
      })

      console.log(
        `<details>\n<summary>${count} Styles — ${kind}: ${summary}</summary>\n`,
      )
      console.log(
        '| Framework | Pass 1 (ns ±%) | Pass 2 (ns ±%) | Samples | CSS gzip | JS gzip | Total gzip |',
      )
      console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: |')

      for (const library of libraries) {
        const measurements = passes.map((pass) => pass.get(library)!)

        const size = JSON.parse(
          Fs.readFileSync(
            Path.join(
              directory,
              'runtime',
              String(count),
              kind,
              `${library}.json`,
            ),
            'utf8',
          ),
        )
        if (
          size.library !== library ||
          !Number.isSafeInteger(size.css?.gzip) ||
          !Number.isSafeInteger(size.javascript?.gzip) ||
          size.total?.gzip !== size.css.gzip + size.javascript.gzip
        )
          throw new Error(`Invalid delivery sizes: ${library}`)

        const status = (() => {
          if (library === 'baseline') return ''
          if (losses.includes(library)) return '🔴 '
          if (library !== 'zyzz') return ''
          if (losses.length) return '🔴 '
          if (kind === 'dynamic') return ''

          return wins ? '🟢 ' : '🟡 '
        })()

        console.log(
          `| ${status}${names[library]} | ${measurements.map((timing) => `${(timing.mean * 1e6).toFixed(1)} ±${timing.rme.toFixed(1)}%`).join(' | ')} | ${measurements.map((timing) => timing.sampleCount).join(' / ')} | ${size.css.gzip} B | ${size.javascript.gzip} B | ${size.total.gzip} B |`,
        )
      }

      console.log('\n</details>\n')
    } catch (error) {
      process.exitCode = 1
      console.log('🔴 Missing or invalid runtime measurements.\n')
      console.error(error)
    }
  }

/** Returns the lowest measured time and its ratio against the runner-up. */
function winner(options: winner.Options): string {
  const ranked = options.measurements
    .map((item) => ({
      ...item,
      value: Number(item.value.toFixed(options.decimals)),
    }))
    .sort((a, b) => a.value - b.value)

  const first = ranked[0]
  if (
    !first ||
    ranked.some((item) => !Number.isFinite(item.value) || item.value < 0)
  )
    return '🟡 No valid timings'

  const tied = ranked.filter((item) => item.value === first.value)
  const time = `${first.value.toFixed(options.decimals)} ${options.unit}`
  if (tied.length > 1)
    return `🟡 Tie: ${tied.map((item) => item.name).join(', ')} — ${time}`

  const next = ranked[1]
  const ratio =
    next && first.value > 0
      ? ` · ${(next.value / first.value).toFixed(2)}× as fast as ${next.name}`
      : ''

  return `${first.name.startsWith('Zyzz') ? '🟢' : '🔴'} ${first.name} — ${time}${ratio}`
}

/** Display inputs for one matched timing comparison. */
declare namespace winner {
  /** Measured values share one workload and timing unit. */
  type Options = {
    /** Decimal places used for times and displayed ties. */
    decimals: number
    /** Comparable framework or implementation timings. */
    measurements: readonly {
      /** Display name. */
      name: string
      /** Measured duration in the supplied unit. */
      value: number
    }[]
    /** Displayed timing unit. */
    unit: 'ms' | 'ns'
  }
}
