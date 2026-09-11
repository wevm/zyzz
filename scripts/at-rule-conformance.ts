/** Tracks at-rule grammars, descriptors, and independently reviewed implementation evidence. @module */
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Path from 'node:path'

const require = Module.createRequire(import.meta.url)
const directory = Path.resolve(import.meta.dirname, '../test/conformance')
const index = process.argv.indexOf('--inventory')
if (index !== -1 && !process.argv[index + 1])
  throw new Error('--inventory requires a path')
const file =
  index === -1
    ? Path.join(directory, 'at-rules.json')
    : Path.resolve(process.argv[index + 1]!)
const update = process.argv.includes('--update')
const full = process.argv.includes('--require-full')
if (update && full)
  throw new Error('--require-full cannot be combined with --update')
type Entry = {
  evidence: readonly string[]
  grammar: string
  status: 'deferred' | 'partial' | 'supported'
}
type Inventory = { entries: Record<string, Entry>; version: string }
type Rule = { descriptors?: Record<string, unknown> }
const data: Record<string, Rule> = require('mdn-data/css/at-rules.json')
const supplements: Record<string, unknown> = JSON.parse(
  Fs.readFileSync(Path.join(directory, 'at-rule-supplements.json'), 'utf8'),
)
const grammars: Record<string, unknown> = {}
for (const [name, rule] of Object.entries(data)) {
  grammars[name] = rule
  for (const [descriptor, value] of Object.entries(rule.descriptors ?? {}))
    grammars[`${name}/${descriptor}`] = value
}
for (const [name, value] of Object.entries(supplements))
  grammars[name] = Object.hasOwn(grammars, name)
    ? { upstream: grammars[name], supplement: value }
    : value
const previous: Inventory = Fs.existsSync(file)
  ? JSON.parse(Fs.readFileSync(file, 'utf8'))
  : { entries: {}, version: '' }
const version: string = require('mdn-data/package.json').version
const current: Inventory = { entries: {}, version }
const errors: string[] = []
for (const name of Object.keys(grammars).sort()) {
  const grammar = Crypto.createHash('sha256')
    .update(JSON.stringify(grammars[name]))
    .digest('hex')
  const old = previous.entries[name]
  current.entries[name] = {
    evidence: old?.grammar === grammar ? old.evidence : [],
    grammar,
    status: old?.grammar === grammar ? old.status : 'deferred',
  }
  if (!old || old.grammar !== grammar) errors.push(`Grammar changed: ${name}`)
  if (old && !['deferred', 'partial', 'supported'].includes(old.status))
    errors.push(`Invalid status: ${name}`)
  if (old && old.status !== 'deferred' && !old.evidence.length)
    errors.push(`Missing evidence: ${name}`)
  for (const evidence of old?.evidence ?? []) {
    const root = Path.resolve(directory, '../..')
    const path = Path.resolve(root, evidence)
    const relative = Path.relative(root, path)
    const valid = (() => {
      if (relative.startsWith('..') || Path.isAbsolute(relative)) return false
      try {
        const real = Path.relative(root, Fs.realpathSync(path))
        return (
          !real.startsWith('..') &&
          !Path.isAbsolute(real) &&
          Fs.statSync(path).isFile()
        )
      } catch {
        return false
      }
    })()
    if (!valid) errors.push(`Missing evidence file: ${name}: ${evidence}`)
  }
}
for (const name of Object.keys(previous.entries))
  if (!(name in grammars)) errors.push(`Removed grammar: ${name}`)
if (previous.version !== version) errors.push(`MDN version changed: ${version}`)
if (update) Fs.writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`)
else {
  console.log('# At-rule Conformance\n')
  console.log(
    `Pinned MDN data: ${version}. Supplementary rules and nested blocks are reviewed separately.\n`,
  )
  console.log('| Context | Supported | Total |\n| --- | ---: | ---: |')
  for (const nested of [false, true]) {
    const entries = Object.entries(current.entries).filter(
      ([name]) => name.includes('/') === nested,
    )
    console.log(
      `| ${nested ? 'Descriptors and nested blocks' : 'At-rules'} | ${entries.filter(([, value]) => value.status === 'supported').length} | ${entries.length} |`,
    )
  }
  if (full)
    for (const [name, entry] of Object.entries(current.entries))
      if (entry.status !== 'supported') errors.push(`Incomplete: ${name}`)
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exitCode = 1
  }
}
