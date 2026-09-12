/** Verifies live descriptor replacement without stale named-rule output. @module */
import { describe, expect, test } from 'vite-plus/test'
import * as Fs from 'node:fs/promises'
import { Host } from 'zyzz/node'
import * as NamedDescriptors from '../../test/fixtures/NamedDescriptors.js'
import * as Path from 'node:path'
import * as Watch from '../../test/fixtures/Watch.js'

const updates = {
  counter: [
    ["system:'additive'", "system:'symbolic'"],
    ['10 "X", 1 "I", 0 "O"', '20 "Y", 2 "J", 0 "Z"'],
    ["fallback:'decimal'", "fallback:'lower-roman'"],
    ['negative:\'"(" ")"\'', 'negative:\'"-"\''],
    ['2 "0"', '3 "x"'],
    ['prefix:\'"["\'', 'prefix:\'"("\''],
    ["range:'0 99'", "range:'1 100'"],
    ["speakAs:'numbers'", "speakAs:'words'"],
    ['suffix:\'"]"\'', 'suffix:\'")"\''],
    ['symbols:\'"I"\'', 'symbols:\'"J"\''],
  ],
  font: [
    ['Body', 'Changed'],
    ["fontDisplay:'swap'", "fontDisplay:'optional'"],
    ['"kern" 1', '"liga" 0'],
    ['"wght" 450', '"wght" 500'],
    ['75% 125%', '80% 120%'],
    ['oblique 0deg 20deg', 'italic'],
    ['100 900', '200 800'],
    ['U+0-7F,U+4??', 'U+20-FF'],
    ['90%', '85%'],
    ['20%', '25%'],
    ['5%', '6%'],
    ['110%', '120%'],
    ['/body.woff2', '/changed.woff2'],
  ],
  palette: [
    ['Body', 'Changed'],
    ["basePalette:'dark'", "basePalette:'light'"],
    ['0 red, 1 color(display-p3 0 1 0), 1 #00f', '0 blue, 1 green'],
  ],
  position: [
    ["'bottom'", "'top'"],
    ['--target', '--changed'],
    ['100px', '120px'],
    ['20px', '30px'],
    ['4px', '8px'],
    ['1px', '2px'],
    ['auto', '0px'],
    ['center', 'end'],
  ],
} as const

describe('create', () => {
  for (const family of Object.keys(
    NamedDescriptors.definitions,
  ) as (keyof typeof NamedDescriptors.definitions)[]) {
    test(`replaces ${family} descriptors and retains source-owned names during watch`, async () => {
      const root = await Fs.mkdtemp(
        Path.resolve(import.meta.dirname, '../../.fixture-descriptor-'),
      )
      try {
        const path = Path.join(root, 'names.ts')
        const source = NamedDescriptors.source(family)
        const updatedSource = updates[family].reduce(
          (source, [before, after]) => source.replaceAll(before, after),
          source,
        )
        await Fs.writeFile(path, source)
        await using host = await Host.create({
          root,
          outDir: Path.join(root, 'output'),
          packageId: 'descriptors',
        })
        await host.build()
        const initial = await Fs.readFile(
          Path.join(root, 'output/zyzz.shared.css'),
          'utf8',
        )

        const notifications = Watch.create({ path: 'zyzz.shared.css' })
        host.watch({ onResult: notifications.onResult })
        await notifications.next(() =>
          Watch.write({ path, source: updatedSource }),
        )
        const updated = await Fs.readFile(
          Path.join(root, 'output/zyzz.shared.css'),
          'utf8',
        )
        const freshRoot = await Fs.mkdtemp(
          Path.resolve(import.meta.dirname, '../../.fixture-descriptor-fresh-'),
        )
        try {
          await Fs.writeFile(Path.join(freshRoot, 'names.ts'), updatedSource)
          await using fresh = await Host.create({
            root: freshRoot,
            outDir: Path.join(freshRoot, 'output'),
            packageId: 'descriptors',
          })
          await fresh.build()
          expect(
            updated ===
              (await Fs.readFile(
                Path.join(freshRoot, 'output/zyzz.shared.css'),
                'utf8',
              )),
          ).toMatchInlineSnapshot('true')
        } finally {
          await Fs.rm(freshRoot, { recursive: true, force: true })
        }
        expect(updated === initial).toMatchInlineSnapshot('false')
        expect(updated.includes('@media print')).toMatchInlineSnapshot('true')
        expect(updated.includes('body')).toMatchInlineSnapshot('true')
      } finally {
        await Fs.rm(root, { recursive: true, force: true })
      }
    })
  }
})
