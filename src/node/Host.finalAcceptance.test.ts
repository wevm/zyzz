/** Verifies page descriptors and property registrations during real source watch. @module */
import { describe, expect, test } from 'vite-plus/test'
import * as Fs from 'node:fs/promises'
import * as Functions from '../../test/fixtures/Functions.js'
import { Host } from 'zyzz/node'
import * as Pages from '../../test/fixtures/Pages.js'
import * as Path from 'node:path'
import * as Registrations from '../../test/fixtures/Registrations.js'
import * as Watch from '../../test/fixtures/Watch.js'

const sources = {
  function: Functions.source,
  page: Pages.source,
  property: Registrations.source,
}
describe('create', () => {
  for (const [family, source] of Object.entries(sources)) {
    test(`replaces ${family} definitions during source watch`, async () => {
      const root = await Fs.mkdtemp(
        Path.resolve(import.meta.dirname, '../../.fixture-statements-'),
      )
      try {
        const path = Path.join(root, 'statements.ts')
        await Fs.writeFile(path, source(false))
        await using host = await Host.create({
          root,
          outDir: Path.join(root, 'output'),
          packageId: 'statements',
        })
        await host.build()
        const initial = await Fs.readFile(
          Path.join(root, 'output/zyzz.shared.css'),
          'utf8',
        )
        const notifications = Watch.create({ path: 'zyzz.shared.css' })
        host.watch({ onResult: notifications.onResult })
        await notifications.next(() =>
          Watch.write({ path, source: source(true) }),
        )
        const updated = await Fs.readFile(
          Path.join(root, 'output/zyzz.shared.css'),
          'utf8',
        )
        expect(updated === initial).toMatchInlineSnapshot('false')
        expect(updated.includes('before')).toMatchInlineSnapshot('false')
        expect(
          updated.includes(
            family === 'function' ? '<length>: 2px' : 'width > 1px',
          ),
        ).toMatchInlineSnapshot('false')
        expect(
          updated.includes(family === 'page' ? 'Before' : 'inherits: false'),
        ).toMatchInlineSnapshot('false')
      } finally {
        await Fs.rm(root, { recursive: true, force: true })
      }
    })
  }
})
