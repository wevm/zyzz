/** Exercises imported stylesheet asset trees through the standalone publishing host. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'
import { Host } from 'zyzz/node'
import * as Watch from '../../test/fixtures/Watch.js'

describe('create', () => {
  test('publishes UTF-8 stylesheet bytes without a BOM or encoding declaration', async () => {
    const root = await Fs.mkdtemp(
      Path.resolve(import.meta.dirname, '../../.fixture-encoding-'),
    )
    try {
      await Fs.writeFile(
        Path.join(root, 'app.ts'),
        `import {global} from 'zyzz/web';global({'body::before':{content:'"héllo ● 日本語"'}});`,
      )
      await using host = await Host.create({
        root,
        outDir: Path.join(root, 'output'),
        packageId: 'encoding',
      })
      await host.build()
      const bytes = await Fs.readFile(Path.join(root, 'output/zyzz.shared.css'))

      expect(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
        .toMatchInlineSnapshot(`
        "body:before {
          content: "héllo ● 日本語";
        }
        "
      `)
      expect(
        bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
      ).toMatchInlineSnapshot('false')
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
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
      const notifications = Watch.create({ path: 'styles/nested.css' })
      host.watch({ onResult: notifications.onResult })
      await notifications.next(() =>
        Watch.write({
          path: Path.join(root, 'styles/nested.css'),
          source: 'body{color:blue}',
        }),
      )
      expect(
        await Fs.readFile(Path.join(root, 'output/styles/nested.css'), 'utf8'),
      ).toMatchInlineSnapshot('"body{color:blue}"')
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
})
