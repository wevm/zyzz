/** Exercises the native audit CLI against the checked-in upstream declarations. @module */
import * as ChildProcess from 'node:child_process'
import * as Path from 'node:path'
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
      '"React Native 0.87.0: 387 component/property pairs, 6 StyleSheet APIs. Complete parity: pending type/value-domain audit and iOS/Android evidence."',
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
