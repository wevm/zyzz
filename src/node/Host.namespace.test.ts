/** Verifies namespace publication and source-owned watch updates through the filesystem host. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'
import { Host } from 'zyzz/node'
import * as Watch from '../../test/fixtures/Watch.js'

describe('create', () => {
  test('rebuilds Unicode namespace bindings and preserves unrelated module scopes', async () => {
    const root = await Fs.mkdtemp(
      Path.resolve(import.meta.dirname, '../../.fixture-namespace-'),
    )
    const source = (uri: string) =>
      `import {namespace as ns,global} from 'zyzz/web';ns({prefix:'图',uri:${JSON.stringify(uri)}});global({'图|item':{color:'red'}});`
    try {
      await Fs.writeFile(Path.join(root, 'shapes.ts'), source('urn:first'))
      await Fs.writeFile(
        Path.join(root, 'other.ts'),
        `import {namespace,global} from 'zyzz/web';namespace({prefix:'图',uri:'urn:other'});global({'图|item':{color:'blue'}});`,
      )
      await using host = await Host.create({
        root,
        outDir: Path.join(root, 'output'),
        packageId: 'namespaces',
      })
      await host.build()
      const initial = await Fs.readFile(
        Path.join(root, 'output/zyzz.shared.css'),
        'utf8',
      )
      expect(initial.includes('"urn:first"')).toMatchInlineSnapshot('true')
      expect(initial.includes('"urn:other"')).toMatchInlineSnapshot('true')

      const notifications = Watch.create({ path: 'zyzz.shared.css' })
      host.watch({ onResult: notifications.onResult })
      await notifications.next(() =>
        Watch.write({
          path: Path.join(root, 'shapes.ts'),
          source: source('urn:second'),
        }),
      )
      const updated = await Fs.readFile(
        Path.join(root, 'output/zyzz.shared.css'),
        'utf8',
      )
      expect(updated.includes('"urn:first"')).toMatchInlineSnapshot('false')
      expect(updated.includes('"urn:second"')).toMatchInlineSnapshot('true')
      expect(updated.includes('"urn:other"')).toMatchInlineSnapshot('true')
      expect(updated.includes('color: red')).toMatchInlineSnapshot('true')
      expect(updated.includes('color: #00f')).toMatchInlineSnapshot('true')
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
})
