/** Exercises property discovery and drift through the conformance CLI. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'

describe('CSS conformance', () => {
  test('discovers compatibility names without inheriting grammar or support', () => {
    const root = Fs.mkdtempSync(Path.resolve('.fixture-css-discovery-'))
    const require = Module.createRequire(import.meta.url)
    const source = Path.resolve(import.meta.dirname, '..')
    try {
      Fs.mkdirSync(Path.join(root, 'scripts'), { recursive: true })
      Fs.copyFileSync(
        Path.join(source, 'scripts/css-conformance.ts'),
        Path.join(root, 'scripts/css-conformance.ts'),
      )
      Fs.cpSync(
        Path.join(source, 'test/conformance'),
        Path.join(root, 'test/conformance'),
        { recursive: true },
      )
      for (const [name, entry] of [
        ['mdn-data', 'mdn-data/package.json'],
        ['@mdn/browser-compat-data', '@mdn/browser-compat-data'],
      ] as const)
        Fs.cpSync(
          Path.dirname(require.resolve(entry)),
          Path.join(root, 'node_modules', name),
          { recursive: true },
        )

      const file = Path.join(root, 'test/conformance/coverage.json')
      const before = JSON.parse(Fs.readFileSync(file, 'utf8'))
      for (const name of [
        '-moz-osx-font-smoothing',
        '-webkit-font-smoothing',
        '-moz-transform',
      ])
        delete before.families.properties[name]
      before.families.properties.color.evidence = [
        'src/compiler/Transform.test.ts',
      ]
      Fs.writeFileSync(file, JSON.stringify(before))

      const dataFile = Path.join(
        root,
        'node_modules/@mdn/browser-compat-data/data.json',
      )
      const data = JSON.parse(Fs.readFileSync(dataFile, 'utf8'))
      data.css.properties['discovery-fixture'] = {
        __compat: {
          support: {
            chrome: [
              { prefix: '-fixture-', version_added: '1', version_removed: '2' },
              { alternative_name: 'fixture-alternative', version_added: true },
              {
                alternative_name: 'unsupported-alternative',
                version_added: false,
              },
              { prefix: '-unknown-', version_added: null },
            ],
            chrome_android: 'mirror',
          },
        },
        value: {
          __compat: {
            support: {
              chrome: {
                alternative_name: 'not-a-property',
                version_added: '1',
              },
            },
          },
        },
      }
      Fs.writeFileSync(dataFile, JSON.stringify(data))
      const run = (...args: string[]) =>
        ChildProcess.spawnSync(
          process.execPath,
          ['scripts/css-conformance.ts', ...args],
          { cwd: root, encoding: 'utf8', timeout: 10_000 },
        )

      expect(run().status).toMatchInlineSnapshot(`1`)
      expect(run('--update').status).toMatchInlineSnapshot(`0`)
      const after = JSON.parse(Fs.readFileSync(file, 'utf8'))
      const properties = after.families.properties
      expect(
        Object.keys(properties).filter(
          (name) => properties[name].status === 'unclassified',
        ),
      ).toMatchInlineSnapshot(`
        [
          "-fixture-discovery-fixture",
          "-moz-osx-font-smoothing",
          "-moz-transform",
          "-webkit-font-smoothing",
          "discovery-fixture",
          "fixture-alternative",
        ]
      `)
      expect(properties.color.evidence).toMatchInlineSnapshot(
        `
        [
          "src/compiler/Transform.test.ts",
        ]
      `,
      )
      expect(
        Object.hasOwn(properties, 'custom-property'),
      ).toMatchInlineSnapshot(`false`)
      expect(
        properties['--*'].grammar === before.families.properties['--*'].grammar,
      ).toMatchInlineSnapshot(`true`)
      expect(
        properties['font-smooth'].grammar ===
          before.families.properties['font-smooth'].grammar,
      ).toMatchInlineSnapshot(`true`)
      expect(
        properties['-webkit-font-smoothing'].grammar ===
          properties['font-smooth'].grammar,
      ).toMatchInlineSnapshot(`false`)
      expect(
        run().stderr.includes(
          'Unclassified properties: -webkit-font-smoothing',
        ),
      ).toMatchInlineSnapshot(`true`)

      for (const entry of Object.values(properties) as { status: string }[])
        if (entry.status === 'unclassified') entry.status = 'deferred'
      Fs.writeFileSync(file, JSON.stringify(after))
      expect(run().status).toMatchInlineSnapshot(`0`)
      expect(run('--require-full').status).toMatchInlineSnapshot(`1`)

      data.css.properties['font-smooth'].__compat.support.chrome.version_added =
        '6'
      Fs.writeFileSync(dataFile, JSON.stringify(data))
      expect(
        run().stderr.includes('Changed properties: -webkit-font-smoothing'),
      ).toMatchInlineSnapshot(`true`)

      after.compatibilityVersion = 'stale'
      Fs.writeFileSync(file, JSON.stringify(after))
      expect(
        run().stderr.includes('Browser compatibility data stale → 8.1.2'),
      ).toMatchInlineSnapshot(`true`)
    } finally {
      Fs.rmSync(root, { force: true, recursive: true })
    }
  })
})
