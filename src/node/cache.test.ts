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
            "modules": 3,
            "parses": 3,
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
