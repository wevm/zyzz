/** Verifies diagnostics at the public variable authoring boundary. @module */
import { describe, expect, test } from 'vite-plus/test'
import { variable } from 'zyzz'

describe('variable', () => {
  test('identifies the untransformed variable API', () => {
    expect(() => ({
      gap: variable('length'),
    })).toThrowErrorMatchingInlineSnapshot(
      `[variable.MissingTransformError: variable requires a compile-time transform; do not execute untransformed authoring source.]`,
    )
  })
})
