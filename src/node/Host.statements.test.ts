/** Exercises imported stylesheet asset trees through the standalone publishing host. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'
import { Host } from 'zyzz/node'

describe('create', () => {
  test('copies nested stylesheet imports and their relative assets', async () => {
    const root = await Fs.mkdtemp(
      Path.resolve(import.meta.dirname, '../../.fixture-imports-'),
    )
    try {
      await Fs.mkdir(Path.join(root, 'styles'))
      await Fs.writeFile(
        Path.join(root, 'app.ts'),
        `import {importCss} from 'zyzz/web';importCss({url:'./styles/base.css',layer:'base'});`,
      )
      await Fs.writeFile(
        Path.join(root, 'styles/base.css'),
        '@import "nested.css";body{background-image:url(../pixel.svg)}',
      )
      await Fs.writeFile(
        Path.join(root, 'styles/nested.css'),
        'body{color:red}',
      )
      await Fs.writeFile(Path.join(root, 'pixel.svg'), '<svg/>')
      await using host = await Host.create({
        root,
        outDir: Path.join(root, 'output'),
        packageId: 'imports',
      })
      await host.build()
      expect(
        await Fs.readFile(Path.join(root, 'output/zyzz.shared.css'), 'utf8'),
      ).toMatchInlineSnapshot(`
        "@import "styles/base.css" layer(base);
        "
      `)
      expect(
        await Fs.readFile(Path.join(root, 'output/styles/base.css'), 'utf8'),
      ).toMatchInlineSnapshot(
        '"@import "nested.css";body{background-image:url(../pixel.svg)}"',
      )
      expect(
        await Fs.readFile(Path.join(root, 'output/styles/nested.css'), 'utf8'),
      ).toMatchInlineSnapshot('"body{color:red}"')
      expect(
        await Fs.readFile(Path.join(root, 'output/pixel.svg'), 'utf8'),
      ).toMatchInlineSnapshot('"<svg/>"')
      await Fs.writeFile(
        Path.join(root, 'styles/nested.css'),
        'body{color:blue}',
      )
      await host.build()
      expect(
        await Fs.readFile(Path.join(root, 'output/styles/nested.css'), 'utf8'),
      ).toMatchInlineSnapshot('"body{color:blue}"')
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
})
