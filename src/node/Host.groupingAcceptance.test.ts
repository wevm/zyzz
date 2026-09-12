/** Verifies global and nested grouping rules survive publication and source replacement. @module */
import { describe, expect, test } from 'vite-plus/test'
import * as Fs from 'node:fs/promises'
import * as GroupingRules from '../../test/fixtures/GroupingRules.js'
import { Host } from 'zyzz/node'
import * as Path from 'node:path'
import * as Watch from '../../test/fixtures/Watch.js'

describe('create', () => {
  for (const [family, headers] of Object.entries(GroupingRules.rules)) {
    test(`replaces ${family} groups through source watch`, async () => {
      const root = await Fs.mkdtemp(
        Path.resolve(import.meta.dirname, '../../.fixture-group-'),
      )
      try {
        const path = Path.join(root, 'groups.ts')
        const source = (color: string) =>
          `import {global} from 'zyzz/web';${headers.map((header) => `global({${JSON.stringify(header)}:{body:{color:${JSON.stringify(color)}}}});`).join('\n')}`
        await Fs.writeFile(path, source('red'))
        await using host = await Host.create({
          root,
          outDir: Path.join(root, 'output'),
          packageId: 'groups',
        })
        await host.build()
        const initial = await Fs.readFile(
          Path.join(root, 'output/zyzz.shared.css'),
          'utf8',
        )
        expect(initial.includes('color: red;')).toMatchInlineSnapshot('true')
        expect(initial.includes('color: #00f;')).toMatchInlineSnapshot('false')

        const notifications = Watch.create({ path: 'zyzz.shared.css' })
        host.watch({ onResult: notifications.onResult })
        await notifications.next(() =>
          Watch.write({ path, source: source('blue') }),
        )
        const updated = await Fs.readFile(
          Path.join(root, 'output/zyzz.shared.css'),
          'utf8',
        )
        expect(updated.includes('color: #00f;')).toMatchInlineSnapshot('true')
        expect(updated.includes('color: red;')).toMatchInlineSnapshot('false')
      } finally {
        await Fs.rm(root, { recursive: true, force: true })
      }
    })
  }
})
