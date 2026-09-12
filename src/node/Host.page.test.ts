/** Verifies publication and live replacement of all sixteen page-margin boxes. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'
import { Host } from 'zyzz/node'
import * as Margins from '../../test/fixtures/PageMargins.js'
import * as Watch from '../../test/fixtures/Watch.js'

describe('create', () => {
  test('replaces all page-margin contents without retaining stale declarations', async () => {
    const root = await Fs.mkdtemp(
      Path.resolve(import.meta.dirname, '../../.fixture-page-'),
    )
    try {
      const path = Path.join(root, 'pages.ts')
      await Fs.writeFile(path, Margins.source('before'))
      await using host = await Host.create({
        outDir: Path.join(root, 'output'),
        packageId: 'pages',
        root,
      })
      await host.build()
      const initial = await Fs.readFile(
        Path.join(root, 'output/zyzz.shared.css'),
        'utf8',
      )
      for (const [index, box] of Margins.boxes.entries()) {
        expect(initial.includes(box)).toMatchInlineSnapshot('true')
        expect(initial.includes(`"before-${index}"`)).toMatchInlineSnapshot(
          'true',
        )
      }

      const notifications = Watch.create({ path: 'zyzz.shared.css' })
      host.watch({ onResult: notifications.onResult })
      await notifications.next(() =>
        Watch.write({ path, source: Margins.source('after') }),
      )
      const updated = await Fs.readFile(
        Path.join(root, 'output/zyzz.shared.css'),
        'utf8',
      )
      expect(updated.includes('before-')).toMatchInlineSnapshot('false')
      for (const [index, box] of Margins.boxes.entries()) {
        expect(updated.includes(box)).toMatchInlineSnapshot('true')
        expect(updated.includes(`"after-${index}"`)).toMatchInlineSnapshot(
          'true',
        )
      }
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
})
