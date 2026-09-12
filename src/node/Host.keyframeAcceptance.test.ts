/** Verifies replacement of animation stops while preserving their referenced identity. @module */
import { describe, expect, test } from 'vite-plus/test'
import * as Fs from 'node:fs/promises'
import { Host } from 'zyzz/node'
import * as Path from 'node:path'
import * as Watch from '../../test/fixtures/Watch.js'

describe('create', () => {
  test('replaces named timeline keyframes while retaining animation references during watch', async () => {
    const root = await Fs.mkdtemp(
      Path.resolve(import.meta.dirname, '../../.fixture-frames-'),
    )
    try {
      const path = Path.join(root, 'frames.ts')
      const source = (stop: string) =>
        `import {keyframes,global} from 'zyzz/web';const fade=keyframes({${JSON.stringify(stop)}:{opacity:0},to:{opacity:1}});global({body:{animationName:fade}});`
      await Fs.writeFile(path, source('entry -20%'))
      await using host = await Host.create({
        root,
        outDir: Path.join(root, 'output'),
        packageId: 'frames',
      })
      await host.build()
      const initial = await Fs.readFile(
        Path.join(root, 'output/zyzz.shared.css'),
        'utf8',
      )
      expect(initial.includes('entry -20%')).toMatchInlineSnapshot('true')
      const notifications = Watch.create({ path: 'zyzz.shared.css' })
      host.watch({ onResult: notifications.onResult })
      await notifications.next(() =>
        Watch.write({ path, source: source('exit 120%') }),
      )
      const updated = await Fs.readFile(
        Path.join(root, 'output/zyzz.shared.css'),
        'utf8',
      )
      expect(updated.includes('entry -20%')).toMatchInlineSnapshot('false')
      expect(updated.includes('exit 120%')).toMatchInlineSnapshot('true')
      expect(updated.includes('animation-name: z-')).toMatchInlineSnapshot(
        'true',
      )
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
})
