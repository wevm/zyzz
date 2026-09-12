/** Exercises conformance gates through the real command-line report. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Os from 'node:os'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'

describe('at-rule conformance', () => {
  test('fingerprints upstream changes when a supplementary grammar overlaps', () => {
    const root = Fs.mkdtempSync(Path.resolve('.fixture-inventory-'))
    try {
      const script = Path.join(root, 'scripts/at-rule-conformance.ts')
      Fs.mkdirSync(Path.dirname(script), { recursive: true })
      Fs.mkdirSync(Path.join(root, 'test/conformance'), { recursive: true })
      Fs.copyFileSync(
        Path.join(import.meta.dirname, 'at-rule-conformance.ts'),
        script,
      )
      const require = Module.createRequire(import.meta.url)
      Fs.cpSync(
        Path.dirname(require.resolve('mdn-data/package.json')),
        Path.join(root, 'node_modules/mdn-data'),
        { recursive: true },
      )
      Fs.writeFileSync(
        Path.join(root, 'test/conformance/at-rule-supplements.json'),
        JSON.stringify({
          '@media': { syntax: '@media <media-query-list> { <rule-list> }' },
        }),
      )
      const run = () =>
        ChildProcess.spawnSync(process.execPath, [script, '--update'], {
          encoding: 'utf8',
          timeout: 10_000,
        })
      expect(run().status).toMatchInlineSnapshot('0')
      const file = Path.join(root, 'test/conformance/at-rules.json')
      const before = JSON.parse(Fs.readFileSync(file, 'utf8')).entries['@media']
        .grammar
      const upstream = Path.join(
        root,
        'node_modules/mdn-data/css/at-rules.json',
      )
      const data = JSON.parse(Fs.readFileSync(upstream, 'utf8'))
      data['@media'].syntax += ' reviewed upstream change'
      Fs.writeFileSync(upstream, JSON.stringify(data))
      expect(run().status).toMatchInlineSnapshot('0')
      expect(
        JSON.parse(Fs.readFileSync(file, 'utf8')).entries['@media'].grammar !==
          before,
      ).toMatchInlineSnapshot('true')
    } finally {
      Fs.rmSync(root, { recursive: true, force: true })
    }
  })
  test('detects drift and refuses completion without evidence', () => {
    const directory = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'zyzz-at-rules-'))
    const file = Path.join(directory, 'inventory.json')
    const source = Path.resolve(
      import.meta.dirname,
      '../test/conformance/at-rules.json',
    )
    function run(...args: string[]) {
      return ChildProcess.spawnSync(
        process.execPath,
        [
          Path.join(import.meta.dirname, 'at-rule-conformance.ts'),
          '--inventory',
          file,
          ...args,
        ],
        { encoding: 'utf8', timeout: 10_000 },
      )
    }
    try {
      Fs.copyFileSync(source, file)
      expect(run().status).toMatchInlineSnapshot('0')
      const inventory = JSON.parse(Fs.readFileSync(file, 'utf8'))
      inventory.entries['@media'].status = 'supported'
      inventory.entries['@media'].gaps = []
      inventory.entries['@media'].evidence = [
        'scripts/at-rule-conformance.test.ts',
      ]
      inventory.entries['@media'].grammar = 'stale'
      Fs.writeFileSync(file, JSON.stringify(inventory))
      expect(run().stderr.trim()).toMatchInlineSnapshot(
        '"Grammar changed: @media"',
      )
      expect(run('--update').status).toMatchInlineSnapshot('0')
      const refreshed = JSON.parse(Fs.readFileSync(file, 'utf8')).entries[
        '@media'
      ]
      expect(refreshed.status).toMatchInlineSnapshot('"deferred"')
      expect(refreshed.evidence).toMatchInlineSnapshot('[]')
      expect(run('--require-full').status).toMatchInlineSnapshot('1')
      inventory.entries['@media'].grammar = JSON.parse(
        Fs.readFileSync(file, 'utf8'),
      ).entries['@media'].grammar
      inventory.entries['@media'].status = 'supported'
      inventory.entries['@media'].gaps = []
      inventory.entries['@media'].evidence = []
      Fs.writeFileSync(file, JSON.stringify(inventory))
      expect(run().stderr.trim()).toMatchInlineSnapshot(
        '"Missing evidence: @media"',
      )
      inventory.entries['@media'].status = 'partial'
      inventory.entries['@media'].gaps = ['Remaining media grammar review.']
      Fs.writeFileSync(file, JSON.stringify(inventory))
      expect(run().stderr.trim()).toMatchInlineSnapshot(
        '"Missing evidence: @media"',
      )
      inventory.entries['@media'].evidence = [
        'scripts/at-rule-conformance.test.ts',
      ]
      inventory.entries['@media'].status = 'supported'
      Fs.writeFileSync(file, JSON.stringify(inventory))
      expect(run().stderr.trim()).toMatchInlineSnapshot(
        '"Supported entry has unresolved gaps: @media"',
      )
      inventory.entries['@media'].status = 'partial'
      for (const evidence of ['.', 'src', '../outside-proof']) {
        inventory.entries['@media'].evidence = [evidence]
        Fs.writeFileSync(file, JSON.stringify(inventory))
        expect(run().status).toMatchInlineSnapshot('1')
      }
      expect(run('--require-full', '--update').status).toMatchInlineSnapshot(
        '1',
      )
    } finally {
      Fs.rmSync(directory, { recursive: true, force: true })
    }
  })
})
