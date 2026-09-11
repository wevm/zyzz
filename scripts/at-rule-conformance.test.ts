/** Exercises conformance gates through the real command-line report. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Os from 'node:os'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'

describe('at-rule conformance', () => {
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
        { encoding: 'utf8' },
      )
    }
    try {
      Fs.copyFileSync(source, file)
      expect(run().status).toMatchInlineSnapshot('0')
      const inventory = JSON.parse(Fs.readFileSync(file, 'utf8'))
      inventory.entries['@media'].grammar = 'stale'
      Fs.writeFileSync(file, JSON.stringify(inventory))
      expect(run().stderr.trim()).toMatchInlineSnapshot(
        '"Grammar changed: @media"',
      )
      expect(run('--update').status).toMatchInlineSnapshot('0')
      expect(run('--require-full').status).toMatchInlineSnapshot('1')
      inventory.entries['@media'].grammar = JSON.parse(
        Fs.readFileSync(file, 'utf8'),
      ).entries['@media'].grammar
      inventory.entries['@media'].status = 'supported'
      inventory.entries['@media'].evidence = []
      Fs.writeFileSync(file, JSON.stringify(inventory))
      expect(run().stderr.trim()).toMatchInlineSnapshot(
        '"Missing evidence: @media"',
      )
      expect(run('--require-full', '--update').status).toMatchInlineSnapshot(
        '1',
      )
    } finally {
      Fs.rmSync(directory, { recursive: true, force: true })
    }
  })
})
