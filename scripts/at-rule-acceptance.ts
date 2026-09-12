/** Checks explicit compiler obligations and independently tracked renderer evidence. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Path from 'node:path'

type Check =
  | { cases: readonly string[]; gap?: never; notApplicable?: never }
  | { cases?: never; gap: string; notApplicable?: never }
  | { cases?: never; gap?: never; notApplicable: string }
type Evidence = { file: string; test?: string }
type Rendering = {
  compatibility: 'native' | 'partial' | 'unsupported' | 'unreviewed'
  cases: readonly string[]
  limitations: readonly string[]
  status: 'partial' | 'unverified' | 'verified'
}
type Matrix = {
  cases: Record<string, Evidence>
  entries: Record<
    string,
    {
      compiler: Record<string, Check>
      grammar: string
      rendering: Record<string, Rendering>
    }
  >
  version: number
}
type Results = {
  success: boolean
  testResults: readonly {
    assertionResults: readonly { fullName: string; status: string }[]
    name: string
  }[]
}

const root = Path.resolve(import.meta.dirname, '..')
const directory = Path.join(root, 'test/conformance')
const index = process.argv.indexOf('--matrix')
if (index !== -1 && !process.argv[index + 1])
  throw new Error('--matrix requires a path')
const file =
  index === -1
    ? Path.join(directory, 'at-rule-matrix.json')
    : Path.resolve(process.argv[index + 1]!)
const matrix: Matrix = JSON.parse(Fs.readFileSync(file, 'utf8'))
const inventory: { entries: Record<string, { grammar: string }> } = JSON.parse(
  Fs.readFileSync(Path.join(directory, 'at-rules.json'), 'utf8'),
)
const compiler = process.argv.includes('--require-full')
const rendering = process.argv.includes('--require-rendering')
const targets = process.argv.includes('--require-targets')
const resultsIndex = process.argv.indexOf('--results')
if (resultsIndex !== -1 && !process.argv[resultsIndex + 1])
  throw new Error('--results requires a path')
const checks = [
  'contexts',
  'grammar',
  'maps',
  'output',
  'packed',
  'references',
  'source',
  'types',
  'watch',
]
const errors: string[] = []
if (matrix.version !== 1) errors.push('Unsupported acceptance matrix version.')

for (const [id, evidence] of Object.entries(matrix.cases)) {
  const path = Path.resolve(root, evidence.file)
  const valid = (() => {
    try {
      const relative = Path.relative(root, Fs.realpathSync(path))
      return (
        !relative.startsWith('..') &&
        !Path.isAbsolute(relative) &&
        Fs.statSync(path).isFile()
      )
    } catch {
      return false
    }
  })()
  if (!valid) errors.push(`Missing evidence file: ${id}`)
  if (evidence.file.endsWith('.test-d.ts')) {
    if (evidence.test !== undefined)
      errors.push(`Type evidence cannot name a runtime test: ${id}`)
  } else if (!evidence.file.endsWith('.test.ts') || !evidence.test?.trim())
    errors.push(`Expected a named integration test: ${id}`)
}

function evidence(ids: readonly string[], owner: string): void {
  if (!Array.isArray(ids) || ids.length === 0) {
    errors.push(`Missing acceptance cases: ${owner}`)
    return
  }
  for (const id of ids) {
    if (!Object.hasOwn(matrix.cases, id))
      errors.push(`Unknown acceptance case: ${owner}: ${id}`)
  }
}

const complete = new Set<string>()
for (const name of Object.keys(inventory.entries)) {
  const entry = matrix.entries[name]
  if (!entry) {
    errors.push(`Missing acceptance entry: ${name}`)
    continue
  }

  const initialErrors = errors.length
  if (entry.grammar !== inventory.entries[name]!.grammar)
    errors.push(`Acceptance grammar requires review: ${name}`)
  const pending: string[] = []
  for (const key of checks) {
    const check = entry.compiler[key]
    if (!check || Object.keys(check).length !== 1) {
      errors.push(`Missing or ambiguous compiler check: ${name}/${key}`)
      continue
    }
    if ('cases' in check && check.cases) {
      evidence(check.cases, `${name}/${key}`)
      if (
        key === 'types' &&
        !check.cases.some((id) => matrix.cases[id]?.file.endsWith('.test-d.ts'))
      )
        errors.push(`Missing public type evidence: ${name}`)
    } else if ('notApplicable' in check && check.notApplicable?.trim()) {
      if (
        key !== 'references' &&
        !(name === '@charset' && ['contexts', 'maps', 'types'].includes(key))
      )
        errors.push(`Compiler check requires evidence: ${name}/${key}`)
    } else if ('gap' in check && check.gap?.trim()) pending.push(key)
    else errors.push(`Empty compiler check: ${name}/${key}`)
  }
  for (const key of Object.keys(entry.compiler))
    if (!checks.includes(key))
      errors.push(`Unknown compiler check: ${name}/${key}`)
  if (pending.length === 0 && errors.length === initialErrors)
    complete.add(name)
  else if (compiler)
    errors.push(`Incomplete compiler entry: ${name} (${pending.join(', ')})`)

  if (Object.keys(entry.rendering).length === 0)
    errors.push(`Missing target review: ${name}`)
  if (
    rendering &&
    !Object.values(entry.rendering).some(
      (review) => review.status === 'verified',
    )
  )
    errors.push(`Missing verified renderer: ${name}`)

  for (const [target, review] of Object.entries(entry.rendering)) {
    const owner = `${name}/${target}`
    if (targets && review.compatibility === 'unreviewed')
      errors.push(`Missing target compatibility review: ${owner}`)
    if (!['partial', 'unverified', 'verified'].includes(review.status))
      errors.push(`Invalid target status: ${owner}`)
    if (
      !['native', 'partial', 'unsupported', 'unreviewed'].includes(
        review.compatibility,
      )
    )
      errors.push(`Invalid target compatibility: ${owner}`)
    if (
      review.compatibility !== 'unreviewed' ||
      review.status !== 'unverified' ||
      review.cases.length
    )
      evidence(review.cases, owner)
    if (review.status === 'verified' && review.compatibility !== 'native')
      errors.push(`Verified rendering requires native compatibility: ${owner}`)
    if (review.status === 'verified' && review.limitations.length)
      errors.push(`Verified target retains limitations: ${owner}`)
    if (
      review.status !== 'verified' &&
      !review.limitations.some((value) => value.trim())
    )
      errors.push(`Missing target limitations: ${owner}`)
  }
}
for (const name of Object.keys(matrix.entries))
  if (!Object.hasOwn(inventory.entries, name))
    errors.push(`Unknown acceptance entry: ${name}`)

console.log('# At-rule Compiler Acceptance\n')
console.log('| Context | Reviewed complete | Total |\n| --- | ---: | ---: |')
for (const nested of [false, true]) {
  const names = Object.keys(inventory.entries).filter(
    (name) => name.includes('/') === nested,
  )
  console.log(
    `| ${nested ? 'Descriptors and nested blocks' : 'At-rules'} | ${names.filter((name) => complete.has(name)).length} | ${names.length} |`,
  )
}
console.log(
  '\nTarget compatibility and rendering are reviewed separately. Unsupported targets never count as rendered support.',
)

function verifyResults(report: string): void {
  const results: Results = JSON.parse(Fs.readFileSync(report, 'utf8'))
  if (!results.success) errors.push('Acceptance integration run failed.')
  for (const item of Object.values(matrix.cases).filter((item) => item.test)) {
    const result = results.testResults.find(
      (result) => Path.resolve(result.name) === Path.join(root, item.file),
    )
    if (
      !result?.assertionResults.some(
        (assertion) =>
          assertion.fullName === item.test && assertion.status === 'passed',
      )
    )
      errors.push(
        `Required integration case did not pass: ${item.file}: ${item.test}`,
      )
  }
}

if (!errors.length && resultsIndex !== -1)
  verifyResults(Path.resolve(process.argv[resultsIndex + 1]!))

if (!errors.length && (compiler || rendering || targets)) {
  const run = (
    command: string,
    args: readonly string[],
    env: Readonly<Record<string, string>> = {},
  ) => {
    const result = ChildProcess.spawnSync(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: 'inherit',
      timeout: 900_000,
    })
    if (result.error) throw result.error
    if (result.status !== 0)
      throw new Error(`Acceptance command failed: ${command} ${args.join(' ')}`)
  }
  // The complete type suite exceeds Node's default heap; match the Verify
  // workflow's allowance while preserving caller-supplied options.
  if (compiler)
    run('pnpm', ['check:types'], {
      NODE_OPTIONS:
        `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=4096`.trim(),
    })

  const selected = Object.values(matrix.cases).filter((value) => value.test)
  if (selected.length) {
    const temporary = Fs.mkdtempSync(Path.join(root, '.fixture-acceptance-'))
    try {
      const report = Path.join(temporary, 'results.json')
      run(Path.join(root, 'node_modules/.bin/vp'), [
        'test',
        'run',
        ...new Set(selected.map((value) => value.file)),
        '--reporter=default',
        '--reporter=json',
        `--outputFile=${report}`,
      ])
      verifyResults(report)
    } finally {
      Fs.rmSync(temporary, { recursive: true, force: true })
    }
  }
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
}
