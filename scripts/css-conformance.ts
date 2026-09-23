/**
 * Compares reviewed CSS coverage with pinned upstream grammars and prints CI evidence.
 * @module
 */
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Path from 'node:path'

const require = Module.createRequire(import.meta.url)
const requireFull = process.argv.includes('--require-full')
if (requireFull && process.argv.includes('--update'))
  throw new Error('--require-full cannot be combined with --update')
const directory = Path.resolve(import.meta.dirname, '../test/conformance')
const inventoryIndex = process.argv.indexOf('--inventory')
const file =
  inventoryIndex === -1
    ? Path.join(directory, 'coverage.json')
    : Path.resolve(process.argv[inventoryIndex + 1] ?? '')
if (inventoryIndex !== -1 && !process.argv[inventoryIndex + 1])
  throw new Error('--inventory requires a path')
const families = [
  'functions',
  'properties',
  'selectors',
  'syntaxes',
  'types',
  'units',
] as const
const extensions: Partial<
  Record<(typeof families)[number], Record<string, unknown>>
> = {
  properties: {
    '-moz-osx-font-smoothing': {
      status: 'nonstandard',
      syntax: 'auto | grayscale',
    },
    '-webkit-font-smoothing': {
      status: 'nonstandard',
      syntax: 'auto | none | antialiased | subpixel-antialiased',
    },
  },
}

type Entry = {
  grammar: string
  status: 'deferred' | 'partial' | 'supported' | 'unclassified'
}

type Inventory = {
  families: Record<string, Record<string, Entry>>
  version: string
}

const previous: Inventory = JSON.parse(Fs.readFileSync(file, 'utf8'))
const version: string = require('mdn-data/package.json').version
const current: Inventory = { families: {}, version }
const changes: string[] = []
for (const family of families) {
  const data: Record<string, unknown> = {
    ...require(`mdn-data/css/${family}.json`),
    ...extensions[family],
  }
  const entries: Record<string, Entry> = {}

  current.families[family] = entries

  for (const name of Object.keys(data).sort()) {
    const old = previous.families[family]?.[name]
    const grammar = Crypto.createHash('sha256')
      .update(JSON.stringify(data[name]))
      .digest('hex')

    entries[name] = { grammar, status: old?.status ?? 'unclassified' }

    if (!old) changes.push(`Added ${family}: ${name}`)
    else if (old.grammar !== grammar) changes.push(`Changed ${family}: ${name}`)
  }

  for (const name of Object.keys(previous.families[family] ?? {}))
    if (!(name in data)) changes.push(`Removed ${family}: ${name}`)
}
if (previous.version !== version)
  changes.unshift(`MDN data ${previous.version} → ${version}`)
if (process.argv.includes('--update')) {
  Fs.writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`)
  console.log(changes.join('\n') || 'No upstream changes.')
  console.log(
    'Updated grammar snapshot. Review the diff and classify new entries before committing.',
  )
} else {
  console.log('# CSS Conformance Report\n')
  console.log(
    `MDN data: ${version}. Grammar drift includes referenced syntaxes and metadata.\n`,
  )
  console.log(
    '| Family | 🟢 Supported | 🟡 Partial | ⚪ Deferred | 🔴 Unclassified |',
  )
  console.log('| --- | ---: | ---: | ---: | ---: |')

  const atRules = JSON.parse(
    Fs.readFileSync(Path.join(directory, 'at-rules.json'), 'utf8'),
  ) as { entries: Record<string, Entry> }
  const reports = {
    'at-rules': Object.fromEntries(
      Object.entries(atRules.entries).filter(([name]) => !name.includes('/')),
    ),
    ...current.families,
  }
  for (const [family, entries] of Object.entries(reports)) {
    const counts = { deferred: 0, partial: 0, supported: 0, unclassified: 0 }

    for (const [name, entry] of Object.entries(entries)) {
      if (!Object.hasOwn(counts, entry.status))
        changes.push(`Invalid status ${family}: ${name}`)
      else counts[entry.status]++

      if (entry.status === 'unclassified')
        changes.push(`Unclassified ${family}: ${name}`)
    }

    console.log(
      `| ${family} | ${counts.supported} | ${counts.partial} | ${counts.deferred} | ${counts.unclassified} |`,
    )
  }

  const properties = Object.entries(current.families.properties!)
  const incomplete = properties.filter(
    ([, entry]) => entry.status !== 'supported',
  )
  const supported = properties.length - incomplete.length
  const percentage =
    properties.length === 0 ? 0 : (supported / properties.length) * 100

  console.log(
    `\nFull property conformance: **${supported}/${properties.length} (${percentage.toFixed(2)}%)**. Required: **100%**. Partial properties receive no completion credit.`,
  )

  if (requireFull && (properties.length === 0 || incomplete.length > 0)) {
    console.log('\n<details>\n<summary>Incomplete properties</summary>\n')
    console.log('| Property | Status |\n| --- | --- |')

    for (const [name, entry] of incomplete)
      console.log(`| ${name} | ${entry.status} |`)

    console.log('\n</details>')
    console.error(
      `CSS property conformance is below 100%: ${supported}/${properties.length} fully supported; ${incomplete.length} incomplete.`,
    )
    process.exitCode = 1
  }

  if (changes.length) {
    console.error(
      `\n${changes.join('\n')}\nReview upstream changes with pnpm update:css, then classify coverage.json entries.`,
    )
    process.exitCode = 1
  }
}
