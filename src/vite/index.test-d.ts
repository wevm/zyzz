/**
 * Checks the public Vite entrypoint without widening its plugin contract.
 * @module
 */
import type { Plugin } from 'vite'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { targets, zyzz } from 'zyzz/vite'

describe('targets', () => {
  test('returns a Vite plugin without options', () => {
    expectTypeOf(targets()).toEqualTypeOf<Plugin>()

    // @ts-expect-error Browser targets come from the existing Vite configuration.
    targets({ cssTarget: 'chrome123' })
  })
})

describe('zyzz', () => {
  test('returns a Vite plugin and rejects unsupported options', () => {
    expectTypeOf(zyzz()).toEqualTypeOf<Plugin>()

    // @ts-expect-error Plugin configuration is owned by Vite.
    zyzz({ root: '.' })
  })
})
