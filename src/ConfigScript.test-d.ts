/** Verifies bound script options in all configuration modes. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config } from 'zyzz'

describe('create', () => {
  test('infers the script factory without theme input', () => {
    const { script } = Config.create()
    expectTypeOf(script()).toEqualTypeOf<string>()
    expectTypeOf(script({ storageKey: 'appearance' })).toEqualTypeOf<string>()
    // @ts-expect-error Storage keys are strings.
    script({ storageKey: 42 })
    // @ts-expect-error Configuration owns the default.
    script({ defaultTheme: 'base' })
  })
})
