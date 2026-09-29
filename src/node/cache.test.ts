/** Verifies retained compilation state through real consumer builds. @module */
import { describe, expect, test } from 'vite-plus/test'
import * as CompilerCache from '../../test/fixtures/CompilerCache.js'

describe('create', () => {
  test.each(['host'])(
    '%s reuses unchanged compilation and updates edited dependencies',
    async (adapter) => {
      expect(await CompilerCache.verify(adapter)).toMatchInlineSnapshot(`
        {
          "cold": {
            "extractions": 6,
            "parses": 6,
          },
          "edited": {
            "extractions": 4,
            "parses": 3,
          },
          "settled": {
            "extractions": 0,
            "parses": 0,
          },
          "warm": {
            "extractions": 0,
            "parses": 0,
          },
        }
      `)
    },
    60_000,
  )
})
