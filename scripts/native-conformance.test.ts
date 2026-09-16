/** Exercises the native audit CLI against the checked-in upstream declarations. @module */
import * as ChildProcess from 'node:child_process'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'

describe('check', () => {
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
