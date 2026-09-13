#!/usr/bin/env node
/**
 * Runs the colocated attest type benches against the installed TypeScript.
 * @module
 */
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as Url from 'node:url'
import * as Ts from 'typescript'

const root = Path.resolve(import.meta.dirname, '..')
const suffix = '.bench-d.ts'

// Attest measures instantiations through the TypeScript compiler API, which
// the native compiler package does not ship. The widened binding keeps the
// check valid against every TypeScript declaration shape.
const compiler: object = Ts

if (!('createProgram' in compiler)) {
  console.error(
    `TypeScript ${Ts.version} exposes no compiler API; type benches require a JavaScript TypeScript release.`,
  )
  process.exit(1)
}

// Snapshot updates are formatted by the repository formatter, not Prettier.
process.env.ATTEST_shouldFormat ??= 'false'

// Attest reads its own flags from argv, such as --update and --filter; the
// repeatable --fixture flag selects fixture paths by substring.
const selections = process.argv.flatMap((argument, index) =>
  argument === '--fixture' && process.argv[index + 1] !== undefined
    ? [process.argv[index + 1]!]
    : [],
)

const selected = Fs.readdirSync(Path.join(root, 'src'), {
  recursive: true,
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
  .map((entry) => Path.join(entry.parentPath, entry.name))
  .filter(
    (fixture) =>
      !selections.length ||
      selections.some((selection) =>
        Path.relative(root, fixture).includes(selection),
      ),
  )
  .sort()

if (!selected.length) {
  console.error(
    selections.length
      ? `No ${suffix} fixtures match ${selections.join(', ')}.`
      : `No ${suffix} fixtures found under src.`,
  )
  process.exit(1)
}

// Partition the sorted fixture list without assigning modules to runners.
const fixtures = (() => {
  const index = process.argv.indexOf('--shard')
  if (index === -1) return selected

  const value = process.argv[index + 1] ?? ''
  const [shard, count] = value.split('/').map(Number)

  if (
    !/^\d+\/\d+$/.test(value) ||
    !Number.isSafeInteger(shard) ||
    !Number.isSafeInteger(count) ||
    !shard ||
    !count ||
    shard > count ||
    count > selected.length
  ) {
    console.error('--shard requires i/n with 1 <= i <= n <= fixture count.')
    process.exit(1)
  }

  return selected.slice(
    Math.floor(((shard - 1) * selected.length) / count),
    Math.floor((shard * selected.length) / count),
  )
})()

if (process.argv.includes('--list')) {
  console.log(
    fixtures.map((fixture) => Path.relative(root, fixture)).join('\n'),
  )
  process.exit(0)
}

console.log(`TypeScript ${Ts.version}: ${fixtures.length} type bench fixtures`)

const failures: string[] = []

for (const fixture of fixtures) {
  const relative = Path.relative(root, fixture)
  const started = performance.now()

  console.log(`\n${relative}`)

  try {
    await import(Url.pathToFileURL(fixture).href)
  } catch (error) {
    failures.push(relative)
    console.error(error instanceof Error ? error.message : String(error))
  }

  // Attest reports an exceeded type baseline through the process exit code
  // rather than by throwing, so the code is read and cleared per fixture.
  if (process.exitCode) {
    if (!failures.includes(relative)) failures.push(relative)
    process.exitCode = undefined
  }

  console.log(
    `${relative}: ${((performance.now() - started) / 1000).toFixed(1)}s`,
  )
}

if (failures.length) {
  console.error(
    `\n${failures.length} of ${fixtures.length} type bench fixtures failed:\n${failures.join('\n')}`,
  )
  process.exitCode = 1
} else console.log(`\nAll ${fixtures.length} type bench fixtures passed.`)
