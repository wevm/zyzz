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

    zyzz({ native: { colorScheme: 'dark', platform: 'ios' } })
    // @ts-expect-error Native builds require an explicit scheme.
    zyzz({ native: { platform: 'ios' } })
    // @ts-expect-error Native platforms are finite.
    zyzz({ native: { colorScheme: 'dark', platform: 'web' } })

    // @ts-expect-error Plugin configuration is owned by Vite.
    zyzz({ root: '.' })
  })
})
