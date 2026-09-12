/** Verifies diagnostics at the public variable authoring boundary. @module */
import { describe, expect, test } from 'vite-plus/test'
import { Vars } from 'zyzz'

describe('define', () => {
  test('identifies the untransformed variable API', () => {
    expect(() =>
      Vars.define({ gap: 'length' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Vars.MissingTransformError: Vars.define requires a compile-time transform. Source extraction alone does not rewrite calls; do not execute untransformed authoring source.]`,
    )
  })
})
