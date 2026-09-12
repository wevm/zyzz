/** Checks shared effect publication and removal through real files. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'
import { Host } from 'zyzz/node'

describe('create', () => {
  test('publishes unimported globals and removes the shared artifact on deletion', async () => {
    const root = await Fs.mkdtemp(Path.resolve('.fixture-contributions-'))

    try {
      await Fs.writeFile(Path.join(root, 'app.ts'), 'export const value=1')
      await Fs.writeFile(
        Path.join(root, 'global.ts'),
        'import {global} from "zyzz/web"; global({body:{margin:0}})',
      )

      await using host = await Host.create({
        root,
        outDir: Path.join(root, 'output'),
        packageId: 'app',
        css: false,
      })

      await host.build()

      expect(
        await Fs.readFile(Path.join(root, 'output/zyzz.shared.css'), 'utf8'),
      ).toMatchInlineSnapshot(`"body{margin:0;}"`)

      await Fs.unlink(Path.join(root, 'global.ts'))
      await host.build()

      expect(
        (await Fs.readdir(Path.join(root, 'output'))).includes(
          'zyzz.shared.css',
        ),
      ).toMatchInlineSnapshot(`false`)
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
})
