/** Verifies live import conditions, custom media, and legacy document matching updates. @module */
import { describe, expect, test } from 'vite-plus/test'
import * as Fs from 'node:fs/promises'
import { Host } from 'zyzz/node'
import * as Path from 'node:path'
import * as Statements from '../../test/fixtures/Statements.js'
import * as Watch from '../../test/fixtures/Watch.js'

const sources = {
  customMedia: (after: boolean) =>
    `import {customMedia,global} from 'zyzz/web';const query=customMedia('(width > ${after ? 2 : 1}px)');global({[query]:{body:{color:'red'}}});`,
  document: (after: boolean) =>
    `import {global} from 'zyzz/web';global({'@document domain("${after ? 'after' : 'before'}.example")':{body:{color:'red'}}});`,
  import: (after: boolean) =>
    Statements.imports(`https://example.com/${after ? 'after' : 'before'}.css`),
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
        expect(updated.includes('width > 1px')).toMatchInlineSnapshot('false')
        expect(updated.includes('body')).toMatchInlineSnapshot('true')
      } finally {
        await Fs.rm(root, { recursive: true, force: true })
      }
    })
  }
})
