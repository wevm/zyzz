/**
 * Checks consumer inference and rejected inputs through the public css API.
 * @module
 */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { css } from 'zyzz'

describe('css', () => {
  test('infers applied props and rejects invalid styles and overrides', () => {
    const card = css({ color: '#fff', padding: '1rem' })
    expectTypeOf(card).toEqualTypeOf<css.ReturnType>()
    expectTypeOf(
      card({ className: 'external', style: { opacity: 0.5 } }),
    ).toEqualTypeOf<css.Props>()
    // @ts-expect-error Unknown properties cannot hide in aliased objects.
    css({ colour: '#fff' })
    // @ts-expect-error Root calls contain no spacing tokens.
    css({ padding: 4 })
    // @ts-expect-error Root calls contain no color tokens.
    css({ color: 'blue.700' })
    // @ts-expect-error Callbacks require the later dynamic binding phase.
    css(() => ({ padding: 0 }))
    // @ts-expect-error Unrelated component props are not styling overrides.
    card({ id: 'card' })
    const union = {} as { color: '#fff' } | { colour: '#fff'; color: '#fff' }
    // @ts-expect-error Unknown keys in a union branch are rejected.
    css(union)
  })
})
