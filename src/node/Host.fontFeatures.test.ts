/** Verifies complete font feature publication and replacement through filesystem watching. @module */
import { describe, expect, test } from 'vite-plus/test'
import * as FontFeatures from '../../test/fixtures/FontFeatures.js'
import * as Fs from 'node:fs/promises'
import { Host } from 'zyzz/node'
import * as Path from 'node:path'
import * as Watch from '../../test/fixtures/Watch.js'

describe('create', () => {
  test('replaces every feature alias block and font display policy during watch', async () => {
    const root = await Fs.mkdtemp(
      Path.resolve(import.meta.dirname, '../../.fixture-features-'),
    )
    try {
      const path = Path.join(root, 'fonts.ts')
      await Fs.writeFile(path, FontFeatures.source(1))
      await using host = await Host.create({
        root,
        outDir: Path.join(root, 'output'),
        packageId: 'features',
      })
      await host.build()
      const initial = await Fs.readFile(
        Path.join(root, 'output/zyzz.shared.css'),
        'utf8',
      )
      for (const [index, block] of FontFeatures.blocks.entries())
        expect(
          initial.includes(`${block}{alias${index}:1`),
        ).toMatchInlineSnapshot('true')
      expect(initial.includes('font-display:swap')).toMatchInlineSnapshot(
        'true',
      )

      const notifications = Watch.create({ path: 'zyzz.shared.css' })
      host.watch({ onResult: notifications.onResult })
      await notifications.next(() =>
        Watch.write({ path, source: FontFeatures.source(4, 'optional') }),
      )
      const updated = await Fs.readFile(
        Path.join(root, 'output/zyzz.shared.css'),
        'utf8',
      )
      for (const [index, block] of FontFeatures.blocks.entries()) {
        expect(
          updated.includes(`${block}{alias${index}:4`),
        ).toMatchInlineSnapshot('true')
        expect(
          updated.includes(`${block}{alias${index}:1`),
        ).toMatchInlineSnapshot('false')
      }
      expect(updated.includes('font-display:optional')).toMatchInlineSnapshot(
        'true',
      )
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
})
