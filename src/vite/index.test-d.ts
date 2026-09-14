/**
 * Checks the public Vite entrypoint without widening its plugin contract.
 * @module
 */
import type { Plugin } from 'vite'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/vite'

describe('zyzz', () => {
  test('returns a Vite plugin and rejects unsupported options', () => {
    expectTypeOf(zyzz()).toEqualTypeOf<Plugin>()

    // @ts-expect-error Plugin configuration is owned by Vite.
    zyzz({ root: '.' })
  })
})
