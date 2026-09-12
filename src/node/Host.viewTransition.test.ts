/** Verifies live replacement of navigation and transition type descriptors. @module */
import { describe, expect, test } from 'vite-plus/test'
import * as Fs from 'node:fs/promises'
import { Host } from 'zyzz/node'
import * as Path from 'node:path'
import * as Watch from '../../test/fixtures/Watch.js'

describe('create', () => {
  test('replaces navigation and types through source watch updates', async () => {
    const root = await Fs.mkdtemp(
      Path.resolve(import.meta.dirname, '../../.fixture-transition-'),
    )
    try {
      const path = Path.join(root, 'transition.ts')
      await Fs.writeFile(
        path,
        `import {viewTransition} from 'zyzz/web';viewTransition({navigation:'auto',types:'slide forwards'},{within:['@layer transitions']});`,
      )
      await using host = await Host.create({
        root,
        outDir: Path.join(root, 'output'),
        packageId: 'transitions',
      })
      await host.build()
      const initial = await Fs.readFile(
        Path.join(root, 'output/zyzz.shared.css'),
        'utf8',
      )
      expect(initial.includes('navigation: auto')).toMatchInlineSnapshot('true')
      expect(initial.includes('types: slide forwards')).toMatchInlineSnapshot(
        'true',
      )

      const notifications = Watch.create({ path: 'zyzz.shared.css' })
      host.watch({ onResult: notifications.onResult })
      await notifications.next(() =>
        Watch.write({
          path,
          source: `import {viewTransition} from 'zyzz/web';viewTransition({navigation:'none',types:'backwards'},{within:['@layer transitions']});`,
        }),
      )
      const updated = await Fs.readFile(
        Path.join(root, 'output/zyzz.shared.css'),
        'utf8',
      )
      expect(updated.includes('navigation: none')).toMatchInlineSnapshot('true')
      expect(updated.includes('types: backwards')).toMatchInlineSnapshot('true')
      expect(updated.includes('forwards')).toMatchInlineSnapshot('false')
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
})
