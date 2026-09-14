/** Checks root appearance selection inference against a compiled catalog. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Appearance } from 'zyzz/web'

describe('create', () => {
  test('infers catalog names and rejects unknown themes and schemes', () => {
    const appearance = Appearance.create({
      defaults: { colorScheme: 'light dark', theme: 'base' },
      themes: { base: { className: 'z-base' }, mint: { className: 'z-mint' } },
    })

    expectTypeOf(appearance.current()).toEqualTypeOf<
      Appearance.Selection<'base' | 'mint'>
    >()
    expectTypeOf(appearance.restore().theme).toEqualTypeOf<'base' | 'mint'>()

    appearance.select({ theme: 'mint' })
    appearance.select({ colorScheme: 'dark', theme: 'base' })
    // @ts-expect-error Unknown catalog names are rejected.
    appearance.select({ theme: 'ocean' })
    // @ts-expect-error Schemes are limited to light, dark, and light dark.
    appearance.select({ colorScheme: 'auto', theme: 'base' })
    Appearance.create({
      // @ts-expect-error Defaults must name a catalog member.
      defaults: { theme: 'ocean' },
      themes: { base: { className: 'z-base' } },
    })
  })
})
