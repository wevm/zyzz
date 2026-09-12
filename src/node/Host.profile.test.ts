/** Verifies live profile descriptor and source asset ownership. @module */
import * as ColorProfile from '../../test/fixtures/ColorProfile.js'
import { describe, expect, test } from 'vite-plus/test'
import * as Fs from 'node:fs/promises'
import { Host } from 'zyzz/node'
import * as Path from 'node:path'
import * as Watch from '../../test/fixtures/Watch.js'

describe('create', () => {
  test('replaces profile components intent and source assets through watch', async () => {
    const root = await Fs.mkdtemp(
      Path.resolve(import.meta.dirname, '../../.fixture-profile-'),
    )
    try {
      const path = Path.join(root, 'profile.ts')
      await Fs.writeFile(
        Path.join(root, 'before.icc'),
        Buffer.from(ColorProfile.url.split(',')[1]!, 'base64'),
      )
      await Fs.writeFile(
        Path.join(root, 'after.icc'),
        Buffer.from(ColorProfile.url.split(',')[1]!, 'base64'),
      )
      await Fs.writeFile(
        path,
        `import {colorProfile} from 'zyzz/web';export const profile=colorProfile({src:'url(./before.icc)',components:'r,g,b',renderingIntent:'perceptual'},{within:['@media print']});`,
      )
      await using host = await Host.create({
        root,
        outDir: Path.join(root, 'output'),
        packageId: 'profiles',
      })
      await host.build()
      const initial = await Fs.readFile(
        Path.join(root, 'output/zyzz.shared.css'),
        'utf8',
      )
      expect(initial.includes('before.icc')).toMatchInlineSnapshot('true')
      expect(initial.includes('components:r,g,b')).toMatchInlineSnapshot('true')
      expect(
        initial.includes('rendering-intent:perceptual'),
      ).toMatchInlineSnapshot('true')
      expect(
        (await Fs.readFile(Path.join(root, 'output/before.icc'))).equals(
          Buffer.from(ColorProfile.url.split(',')[1]!, 'base64'),
        ),
      ).toMatchInlineSnapshot('true')

      const notifications = Watch.create({ path: 'zyzz.shared.css' })
      host.watch({ onResult: notifications.onResult })
      await notifications.next(() =>
        Watch.write({
          path,
          source: `import {colorProfile} from 'zyzz/web';export const profile=colorProfile({src:'url(./after.icc)',components:'red,green,blue',renderingIntent:'saturation'},{within:['@media print']});`,
        }),
      )
      const updated = await Fs.readFile(
        Path.join(root, 'output/zyzz.shared.css'),
        'utf8',
      )
      expect(updated.includes('after.icc')).toMatchInlineSnapshot('true')
      expect(
        updated.includes('components:red,green,blue'),
      ).toMatchInlineSnapshot('true')
      expect(
        updated.includes('rendering-intent:saturation'),
      ).toMatchInlineSnapshot('true')
      expect(updated.includes('before.icc')).toMatchInlineSnapshot('false')
      expect(
        (await Fs.readFile(Path.join(root, 'output/after.icc'))).equals(
          Buffer.from(ColorProfile.url.split(',')[1]!, 'base64'),
        ),
      ).toMatchInlineSnapshot('true')
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
})
