/** Verifies the bound script factory signature in all configuration modes. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config } from 'zyzz'

describe('create', () => {
  test('infers the script factory without theme input', () => {
    const { script } = Config.create()

    expectTypeOf(script()).toEqualTypeOf<string>()

    // @ts-expect-error The configuration owns the storage key.
    script({ storageKey: 'appearance' })
    // @ts-expect-error Configuration owns the default.
    script({ defaultTheme: 'base' })
  })
})
