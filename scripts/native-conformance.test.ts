/** Exercises the native audit CLI against the checked-in upstream declarations. @module */
import * as ChildProcess from 'node:child_process'
import * as Path from 'node:path'
import * as Fs from 'node:fs/promises'
import { describe, expect, test } from 'vite-plus/test'
import { inventory, staticContracts } from './native-conformance.js'

describe('check', () => {
  test('reproduces static contracts from every pinned component property', async () => {
    await expect(staticContracts()).resolves.toBeUndefined()
    const result = await inventory()

    expect(result.declarations.ImageResizeMode)
      .toMatchInlineSnapshot(`"export type ImageResizeMode =
  | 'cover'
  | 'contain'
  | 'stretch'
  | 'repeat'
  | 'center'
  | 'none';"`)
  }, 30_000)

  test('retains legacy and published component inventories without dropping deprecated properties', async () => {
    await staticContracts()
    const audit = JSON.parse(
      await Fs.readFile(
        new URL(
          '../test/conformance/native/static-inventory.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as {
      published: Record<string, string[]>
      combined: Record<string, string[]>
    }
    expect(
      Object.fromEntries(
        Object.entries(audit.published).map(([name, properties]) => [
          name,
          properties.length,
        ]),
      ),
    ).toMatchInlineSnapshot(`
      {
        "ImageStyle": 130,
        "TextStyle": 147,
        "ViewStyle": 126,
      }
    `)
    expect(
      Object.values(audit.combined).reduce(
        (count, properties) => count + properties.length,
        0,
      ),
    ).toMatchInlineSnapshot('421')
    expect(audit.combined.ViewStyle).toContain('transformMatrix')
    expect(audit.published.ImageStyle).toContain('boxShadow')
  }, 30_000)

  test('audits the actual runtime exports alongside declared signatures', async () => {
    const result = await inventory()

    expect(Object.keys(result.runtimeApi).sort()).toMatchInlineSnapshot(`
      [
        "absoluteFill",
        "compose",
        "create",
        "flatten",
        "hairlineWidth",
        "setStyleAttributePreprocessor",
      ]
    `)
    expect(
      Object.keys(result.runtimeApi).every((name) => name in result.api),
    ).toMatchInlineSnapshot('true')
  })

  test('reports the inherited property inventory through the CLI', () => {
    const result = ChildProcess.spawnSync(
      process.execPath,
      ['scripts/native-conformance.ts'],
      {
        cwd: Path.resolve(import.meta.dirname, '..'),
        encoding: 'utf8',
      },
    )

    expect(result.status).toMatchInlineSnapshot('0')
    expect(result.stdout.trim()).toMatchInlineSnapshot(
      '"React Native 0.87.0: 387 component/property pairs, 6 StyleSheet APIs. Complete parity: pending universal application, host interoperability, and iOS/Android evidence."',
    )
  })

  test('refuses full acceptance without platform evidence', () => {
    const result = ChildProcess.spawnSync(
      process.execPath,
      ['scripts/native-conformance.ts', '--require-full'],
      {
        cwd: Path.resolve(import.meta.dirname, '..'),
        encoding: 'utf8',
      },
    )

    expect(result.status).toMatchInlineSnapshot('1')
    expect(
      result.stderr.includes('Complete parity: pending'),
    ).toMatchInlineSnapshot('true')
  })
})
