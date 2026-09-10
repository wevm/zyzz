/**
 * Reports matched runtime samples and rejects losses confirmed in both passes.
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
const report: Report = JSON.parse(Fs.readFileSync(Path.join(directory, 'timings.json'), 'utf8'))
const groups = report.files.flatMap((file) => file.groups)
const libraries = ['baseline', 'panda', 'stylex', 'tailwind', 'vanilla-extract', 'zyzz']
const names: Record<string, string> = {
  baseline: 'Plain class/style',
  panda: 'Panda CSS',
  stylex: 'StyleX',
  tailwind: 'Tailwind',
  'vanilla-extract': 'vanilla-extract',
  zyzz: 'Zyzz',
}

console.log('## Runtime Framework Comparisons\n')
console.log('Compiled production props application only; no compilation, DOM or React rendering in timings. Both passes run on this runner with reversed framework order. Cached props are distinct from surviving calls.\n')
console.log('🟢 Zyzz faster beyond reported uncertainty in both passes · 🔴 competitor faster in both passes (fails) · 🟡 inconclusive or overlapping uncertainty. Plain class/style is an informational control. No claim of a universal speed advantage follows from a tie.\n')

for (const count of [10, 100])
  for (const kind of ['cached', 'callable', 'overrides']) {
    console.log(`### ${count} Styles — ${kind}\n`)
    try {
      const passes = [1, 2].map((repeat) => {
        const name = `runtime comparison / ${count} styles / ${kind} / repeat ${repeat}`
        const matches = groups.filter((group) => group.fullName === name || group.fullName.endsWith(` > ${name}`))
        if (matches.length !== 1) throw new Error(`Missing or duplicate group: ${name}`)
        return new Map(libraries.map((library) => {
          const entries = matches[0]!.benchmarks.filter((entry) => entry.name === library)
          const timing = entries[0]
          if (entries.length !== 1 || !timing || !Number.isFinite(timing.mean) || timing.mean <= 0 || !Number.isFinite(timing.rme) || timing.rme < 0 || !Number.isInteger(timing.sampleCount) || timing.sampleCount < 100)
            throw new Error(`Invalid timing: ${name} / ${library}`)
          return [library, timing] as const
        }))
      })
      const faster = (a: Timing, b: Timing) => a.mean * (1 + a.rme / 100) < b.mean * (1 - b.rme / 100)
      const losses = libraries.filter((library) => library !== 'baseline' && library !== 'zyzz' && passes.every((pass) => faster(pass.get(library)!, pass.get('zyzz')!)))
      if (losses.length) process.exitCode = 1
      const wins = libraries.filter((library) => library !== 'baseline' && library !== 'zyzz').every((library) => passes.every((pass) => faster(pass.get('zyzz')!, pass.get(library)!)))
      console.log('| Framework | Pass 1 (ns ±%) | Pass 2 (ns ±%) | Samples | CSS gzip | JS gzip | Total gzip |')
      console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: |')
      for (const library of libraries) {
        const measurements = passes.map((pass) => pass.get(library)!)
        const size = JSON.parse(Fs.readFileSync(Path.join(directory, 'runtime', String(count), kind, `${library}.json`), 'utf8'))
        if (size.library !== library || !Number.isSafeInteger(size.css?.gzip) || !Number.isSafeInteger(size.javascript?.gzip) || size.total?.gzip !== size.css.gzip + size.javascript.gzip)
          throw new Error(`Invalid delivery sizes: ${library}`)
        const status = (() => {
          if (library === 'baseline') return ''
          if (losses.includes(library)) return '🔴 '
          if (library !== 'zyzz') return ''
          if (losses.length) return '🔴 '
          return wins ? '🟢 ' : '🟡 '
        })()
        console.log(`| ${status}${names[library]} | ${measurements.map((timing) => `${(timing.mean * 1e6).toFixed(1)} ±${timing.rme.toFixed(1)}%`).join(' | ')} | ${measurements.map((timing) => timing.sampleCount).join(' / ')} | ${size.css.gzip} B | ${size.javascript.gzip} B | ${size.total.gzip} B |`)
      }
      console.log('')
    } catch (error) {
      process.exitCode = 1
      console.log('🔴 Missing or invalid runtime measurements.\n')
      console.error(error)
    }
  }
