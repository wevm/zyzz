/** Verifies document descriptors survive host CSS processing and asset relocation. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'
import { Host } from 'zyzz/node'

describe('create', () => {
  test('publishes feature display descriptors alongside relocated assets', async () => {
    const root = await Fs.mkdtemp(
      Path.resolve(import.meta.dirname, '../../.fixture-document-'),
    )
    try {
      await Fs.writeFile(
        Path.join(root, 'document.ts'),
        `import {fontFeatureValues,global} from 'zyzz/web';fontFeatureValues({families:'Body',fontDisplay:'swap',features:{'@styleset':{editorial:[1,2]}}});global({body:{backgroundImage:'url(./pixel.svg)'}})`,
      )
      await Fs.writeFile(
        Path.join(root, 'pixel.svg'),
        '<svg xmlns="http://www.w3.org/2000/svg"/>',
      )
      await using host = await Host.create({
        root,
        outDir: Path.join(root, 'output'),
        packageId: 'document',
      })
      await host.build()
      expect(
        await Fs.readFile(Path.join(root, 'output/zyzz.shared.css'), 'utf8'),
      ).toMatchInlineSnapshot(`
        "@font-feature-values Body {
          font-display:swap;@styleset{editorial:1 2;}
        }

        body {
          background-image: url("pixel.svg");
        }
        "
      `)
      expect(
        await Fs.readFile(Path.join(root, 'output/pixel.svg'), 'utf8'),
      ).toMatchInlineSnapshot('"<svg xmlns="http://www.w3.org/2000/svg"/>"')
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
})
