/** Verifies diagnostics at the public variable authoring boundary. @module */
import { describe, expect, test } from 'vite-plus/test'
import { variable } from 'zyzz'

describe('variable', () => {
  test('identifies the untransformed variable API', () => {
    expect(() => ({
      gap: variable('length'),
    })).toThrowErrorMatchingInlineSnapshot(
      `[Error: variable requires an explicit id without the compiler plugin.]`,
    )
  })
})
