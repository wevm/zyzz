/**
 * Verifies complete source publication through real host watch rebuilds.
 * @module
 */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'
import { Host } from 'zyzz/node'
import * as Watch from './Watch.js'

describe('write', () => {
  test('publishes multi-chunk source edits without exposing partial modules', async () => {
    const directory = await Fs.mkdtemp(Path.resolve('.fixture-atomic-watch-'))

    try {
      const root = Path.join(directory, 'src')
      const outDir = Path.join(directory, 'output')
      const path = Path.join(root, 'cards.ts')
      const source = `import { style } from 'zyzz'; ${Array.from({ length: 100 }, (_, index) => `export const card${index} = style({ padding: '${index}px' });`).join('\n')}`

      await Fs.mkdir(root)
      await Fs.writeFile(path, source)

      await using host = await Host.create({
        outDir,
        packageId: 'benchmark',
        root,
      })

      const notifications = Watch.create({ path: 'cards.ts.css' })

      await notifications.next(async () => {
        host.watch({ onResult: notifications.onResult })
      })

      expect(Buffer.byteLength(source) > 4096).toMatchInlineSnapshot('true')

      for (const version of [999, 1000, 1001]) {
        const next = source.replace('0px', `${version}px`)

        await notifications.next(() => Watch.write({ path, source: next }))

        expect(
          (await Fs.readFile(path, 'utf8')) === next,
        ).toMatchInlineSnapshot('true')

        const css = await Fs.readFile(Path.join(outDir, 'cards.ts.css'), 'utf8')

        expect(css.includes(`${version}px`)).toMatchInlineSnapshot('true')
        expect(css.includes('99px')).toMatchInlineSnapshot('true')
      }

      expect(await Fs.readdir(root)).toMatchInlineSnapshot(`
        [
          "cards.ts",
        ]
      `)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
  })
})
