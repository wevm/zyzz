/** Exercises compiler and renderer acceptance through real command-line reports. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'

describe('at-rule acceptance', () => {
  test('rejects removed obligations, non-applicable source claims, and unknown evidence', () => {
    const root = Fs.mkdtempSync(Path.resolve('.fixture-matrix-'))
    try {
      const original = Fs.readFileSync(
        'test/conformance/at-rule-matrix.json',
        'utf8',
      )
      const file = Path.join(root, 'matrix.json')
      const run = () =>
        ChildProcess.spawnSync(
          process.execPath,
          ['scripts/at-rule-acceptance.ts', '--matrix', file],
          { encoding: 'utf8', timeout: 10_000 },
        )
      const matrix = JSON.parse(original)
      delete matrix.entries['@namespace'].compiler.source
      Fs.writeFileSync(file, JSON.stringify(matrix))
      expect(run().stderr.trim()).toMatchInlineSnapshot(
        '"Missing or ambiguous compiler check: @namespace/source"',
      )

      matrix.entries['@namespace'].compiler.source = {
        notApplicable: 'No test required.',
      }
      Fs.writeFileSync(file, JSON.stringify(matrix))
      expect(run().stderr.trim()).toMatchInlineSnapshot(
        '"Compiler check requires evidence: @namespace/source"',
      )

      matrix.entries['@namespace'].compiler.source = { cases: ['missing'] }
      Fs.writeFileSync(file, JSON.stringify(matrix))
      expect(run().stderr.trim()).toMatchInlineSnapshot(
        '"Unknown acceptance case: @namespace/source: missing"',
      )
    } finally {
      Fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('invalidates grammar reviews and separates unsupported targets from rendering', () => {
    const root = Fs.mkdtempSync(Path.resolve('.fixture-matrix-'))
    try {
      const matrix = JSON.parse(
        Fs.readFileSync('test/conformance/at-rule-matrix.json', 'utf8'),
      )
      const file = Path.join(root, 'matrix.json')
      const run = (...flags: readonly string[]) =>
        ChildProcess.spawnSync(
          process.execPath,
          ['scripts/at-rule-acceptance.ts', '--matrix', file, ...flags],
          { encoding: 'utf8', timeout: 10_000 },
        )
      matrix.entries['@namespace'].grammar = 'outdated'
      Fs.writeFileSync(file, JSON.stringify(matrix))
      expect(run().stderr.trim()).toMatchInlineSnapshot(
        '"Acceptance grammar requires review: @namespace"',
      )

      const review = matrix.entries['@namespace'].rendering.chromium
      review.compatibility = 'unsupported'
      Fs.writeFileSync(file, JSON.stringify(matrix))
      expect(
        run().stderr.includes(
          'Verified rendering requires native compatibility: @namespace/chromium',
        ),
      ).toMatchInlineSnapshot('true')

      review.status = 'unverified'
      review.limitations = ['Target rejects the fixture.']
      Fs.writeFileSync(file, JSON.stringify(matrix))
      expect(
        run('--require-rendering').stderr.includes(
          'Missing verified renderer: @namespace',
        ),
      ).toMatchInlineSnapshot('true')
    } finally {
      Fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('keeps incomplete compiler checks red independently of renderer support', () => {
    const root = Fs.mkdtempSync(Path.resolve('.fixture-matrix-'))
    try {
      const matrix = JSON.parse(
        Fs.readFileSync('test/conformance/at-rule-matrix.json', 'utf8'),
      )
      matrix.entries['@color-profile'].compiler.grammar = {
        gap: 'Unreviewed descriptor grammar.',
      }
      matrix.entries['@page'].compiler.grammar = {
        gap: 'Unreviewed page grammar.',
      }
      const file = Path.join(root, 'matrix.json')
      Fs.writeFileSync(file, JSON.stringify(matrix))
      const result = ChildProcess.spawnSync(
        process.execPath,
        ['scripts/at-rule-acceptance.ts', '--matrix', file, '--require-full'],
        { encoding: 'utf8', timeout: 10_000 },
      )

      expect(result.status).toMatchInlineSnapshot('1')
      expect(
        result.stderr.includes('Incomplete compiler entry: @color-profile'),
      ).toMatchInlineSnapshot('true')
      expect(
        result.stderr.includes('Incomplete compiler entry: @page'),
      ).toMatchInlineSnapshot('true')
    } finally {
      Fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('does not count a skipped integration case as passing evidence', () => {
    const root = Fs.mkdtempSync(Path.resolve('.fixture-matrix-'))
    try {
      const fixture = Path.join(root, 'Evidence.test.ts')
      Fs.writeFileSync(
        fixture,
        `/** Input verifying that unexecuted assertions provide no acceptance evidence. @module */\nimport {describe,test} from 'vite-plus/test';describe('evidence',()=>{test.skip('unexecuted',()=>{});});`,
      )
      const report = Path.join(root, 'results.json')
      const execution = ChildProcess.spawnSync(
        Path.resolve('node_modules/.bin/vp'),
        ['test', 'run', fixture, '--reporter=json', `--outputFile=${report}`],
        { encoding: 'utf8', timeout: 20_000 },
      )
      expect(execution.status).toMatchInlineSnapshot('0')

      const matrix = JSON.parse(
        Fs.readFileSync('test/conformance/at-rule-matrix.json', 'utf8'),
      )
      matrix.cases['charset.bytes'] = {
        file: Path.relative(process.cwd(), fixture),
        test: 'evidence unexecuted',
      }
      const file = Path.join(root, 'matrix.json')
      Fs.writeFileSync(file, JSON.stringify(matrix))
      const result = ChildProcess.spawnSync(
        process.execPath,
        [
          'scripts/at-rule-acceptance.ts',
          '--matrix',
          file,
          '--results',
          report,
        ],
        { encoding: 'utf8', timeout: 10_000 },
      )
      expect(result.status).toMatchInlineSnapshot('1')
      expect(
        result.stderr.includes(
          `${Path.relative(process.cwd(), fixture)}: evidence unexecuted`,
        ),
      ).toMatchInlineSnapshot('true')
    } finally {
      Fs.rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)
})
