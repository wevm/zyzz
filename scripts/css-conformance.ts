/**
 * Compares reviewed CSS coverage with pinned upstream grammars and prints CI evidence.
 * @module
 */
import type { CompatStatement, Identifier } from '@mdn/browser-compat-data'
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

type Entry = {
  grammar: string
  status: 'deferred' | 'partial' | 'supported' | 'unclassified'
}

type Inventory = {
  compatibilityVersion: string
  families: Record<string, Record<string, Entry>>
  version: string
}

type Supplements = {
  properties: Record<string, unknown>
  syntaxes: Record<string, unknown>
}
const supplements: Supplements = JSON.parse(
  Fs.readFileSync(Path.join(directory, 'property-supplements.json'), 'utf8'),
)
const previous: Inventory = JSON.parse(Fs.readFileSync(file, 'utf8'))
const version: string = require('mdn-data/package.json').version
type Compatibility = {
  __meta: { version: string }
  css: { properties: Record<string, Identifier> }
}
const compatibility: Compatibility = require('@mdn/browser-compat-data')
const compatibilityVersion = compatibility.__meta.version
const properties: Record<string, Record<string, CompatStatement>> = {}
for (const [name, property] of Object.entries(compatibility.css.properties)) {
  const entry = property.__compat
  if (!entry) continue

  const names = new Set([name === 'custom-property' ? '--*' : name])
  for (const support of Object.values(entry.support)) {
    if (!support || typeof support === 'string') continue

    for (const statement of Array.isArray(support) ? support : [support]) {
      if (!statement.version_added) continue

      if (statement.alternative_name) names.add(statement.alternative_name)
      else if (statement.prefix) names.add(`${statement.prefix}${name}`)
    }
  }

  for (const alias of names) {
    properties[alias] ??= {}
    properties[alias]![name] = entry
  }
}
const current: Inventory = { compatibilityVersion, families: {}, version }
const changes: string[] = []
for (const family of families) {
  const data: Record<string, unknown> = {
    ...require(`mdn-data/css/${family}.json`),
  }
  if (family === 'properties')
    for (const [name, compatibility] of Object.entries(properties))
      // Compatibility discovers names, but cannot establish their value grammars.
      if (!Object.hasOwn(data, name)) data[name] = { compatibility }

  if (family === 'properties' || family === 'syntaxes')
    for (const [name, supplement] of Object.entries(supplements[family]))
      data[name] = Object.hasOwn(data, name)
        ? { upstream: data[name], supplement }
        : supplement

  const entries: Record<string, Entry> = {}

  current.families[family] = entries

  for (const name of Object.keys(data).sort()) {
    const old = previous.families[family]?.[name]
    const grammar = Crypto.createHash('sha256')
      .update(JSON.stringify(data[name]))
      .digest('hex')

    entries[name] = { ...old, grammar, status: old?.status ?? 'unclassified' }

    if (!old) changes.push(`Added ${family}: ${name}`)
    else if (old.grammar !== grammar) changes.push(`Changed ${family}: ${name}`)
  }

  for (const name of Object.keys(previous.families[family] ?? {}))
    if (!(name in data)) changes.push(`Removed ${family}: ${name}`)
}
if (previous.compatibilityVersion !== compatibilityVersion)
  changes.unshift(
    `Browser compatibility data ${previous.compatibilityVersion ?? 'none'} → ${compatibilityVersion}`,
  )
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
    `MDN data: ${version}. Browser compatibility data: ${compatibilityVersion}. Fingerprints include grammar and discovery metadata.\n`,
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
