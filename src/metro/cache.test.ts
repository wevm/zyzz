/** Verifies retained compilation state through real consumer builds. @module */
import { describe, expect, test } from 'vite-plus/test'
import * as CompilerCache from '../../test/fixtures/CompilerCache.js'

describe('zyzz', () => {
  test.each(['metro'])(
    '%s reuses unchanged compilation and updates edited dependencies',
    async (adapter) => {
      expect(await CompilerCache.verify(adapter)).toMatchInlineSnapshot(`
        {
          "cold": {
            "modules": 2,
            "parses": 2,
          },
          "edited": {
            "modules": 2,
            "parses": 1,
          },
          "settled": {
            "modules": 0,
            "parses": 0,
          },
          "warm": {
            "modules": 0,
            "parses": 0,
          },
        }
      `)
    },
    60_000,
  )
})
