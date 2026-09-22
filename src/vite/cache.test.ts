/** Verifies retained compilation state through real consumer builds. @module */
import { describe, expect, test } from 'vite-plus/test'
import * as CompilerCache from '../../test/fixtures/CompilerCache.js'

describe('zyzz', () => {
  test.each(['vite'])(
    '%s reuses unchanged compilation and updates edited dependencies',
    async (adapter) => {
      expect(await CompilerCache.verify(adapter)).toMatchInlineSnapshot(`
        {
          "cold": {
            "extractions": 14,
            "parses": 19,
          },
          "edited": {
            "extractions": 12,
            "parses": 15,
          },
          "settled": {
            "extractions": 0,
            "parses": 6,
          },
          "warm": {
            "extractions": 0,
            "parses": 6,
          },
        }
      `)
    },
    60_000,
  )
})
