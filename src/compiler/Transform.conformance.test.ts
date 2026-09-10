/**
 * Verifies the repository conformance command against real inventory files.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'

describe('compile', () => {
  test('CSS conformance enforces full coverage and exact threshold misses', async () => {
    const root = Path.resolve(import.meta.dirname, '../..')
    const inventory = JSON.parse(
      await Fs.readFile(
        Path.join(root, 'test/conformance/coverage.json'),
        'utf8',
      ),
    ) as {
      families: {
        properties: Record<string, { grammar: string; status: string }>
      }
    }
    const current = ChildProcess.spawnSync(
      process.execPath,
      ['scripts/css-conformance.ts', '--require-full'],
      { cwd: root, encoding: 'utf8', timeout: 10_000 },
    )
    expect(current.status).toMatchInlineSnapshot(`0`)
    expect(current.stderr).toMatchInlineSnapshot(`""`)
    expect(
      current.stdout.includes(
        'Partial properties receive no completion credit.',
      ),
    ).toMatchInlineSnapshot(`true`)
    const directory = await Fs.mkdtemp(
      Path.join(root, '.fixture-conformance-threshold-'),
    )
    try {
      // These inventories test threshold arithmetic, not implementation conformance.
      for (const entry of Object.values(inventory.families.properties))
        entry.status = 'supported'
      const file = Path.join(directory, 'coverage.json')
      await Fs.writeFile(file, JSON.stringify(inventory))
      const complete = ChildProcess.spawnSync(
        process.execPath,
        ['scripts/css-conformance.ts', '--inventory', file, '--require-full'],
        { cwd: root, encoding: 'utf8', timeout: 10_000 },
      )
      expect(complete.status).toMatchInlineSnapshot(`0`)
      expect(
        complete.stdout.includes('670/670 (100.00%)'),
      ).toMatchInlineSnapshot(`true`)
      inventory.families.properties.color!.status = 'partial'
      await Fs.writeFile(file, JSON.stringify(inventory))
      const partial = ChildProcess.spawnSync(
        process.execPath,
        ['scripts/css-conformance.ts', '--inventory', file, '--require-full'],
        { cwd: root, encoding: 'utf8', timeout: 10_000 },
      )
      expect(partial.status).toMatchInlineSnapshot(`1`)
      expect(partial.stderr).toMatchInlineSnapshot(
        `"CSS property conformance is below 100%: 669/670 fully supported; 1 incomplete.\n"`,
      )
      expect(
        partial.stdout.includes('| color | partial |'),
      ).toMatchInlineSnapshot(`true`)
      inventory.families.properties.color!.status = 'supported'
      inventory.families.properties.color!.grammar = 'unreviewed'
      await Fs.writeFile(file, JSON.stringify(inventory))
      const stale = ChildProcess.spawnSync(
        process.execPath,
        ['scripts/css-conformance.ts', '--inventory', file, '--require-full'],
        { cwd: root, encoding: 'utf8', timeout: 10_000 },
      )
      expect(stale.status).toMatchInlineSnapshot(`1`)
      expect(
        stale.stderr.includes('Changed properties: color'),
      ).toMatchInlineSnapshot(`true`)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
  })
})
