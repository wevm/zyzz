/** Checks marker state inference and relationship-key authoring without broad state domains. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { css } from 'zyzz'
import { Css } from 'zyzz/web'
describe('marker', () => {
  test('retains finite states and typed relationships', () => {
    const card = Css.marker({
      state: ['open', 'closed'],
      selected: [true, false],
    })
    expectTypeOf(card({ selected: false })).toMatchTypeOf<
      Readonly<Record<`data-${string}`, string>>
    >()
    css({
      [Css.ancestor(card, {
        data: { state: 'open' },
        pseudo: ':hover',
        has: 'a',
      })]: { color: 'red' },
    })
    css({
      [Css.descendant(card)]: { color: 'red' },
      [Css.siblingBefore(card, ':checked')]: { color: 'blue' },
    })
    const extra = { state: 'open' as const, unknown: 'value' }
    // @ts-expect-error state keys stay exact through variables
    Css.ancestor(card, { data: extra })
    // @ts-expect-error unknown states do not widen schema
    card({ status: 'open' })
    // @ts-expect-error invalid values remain errors
    Css.ancestor(card, { data: { state: 'other' } })
    // @ts-expect-error unknown conditions remain errors
    Css.ancestor(card, ':hovr')
    // @ts-expect-error unbounded domains
    Css.marker({ state: [] as string[] })
    // @ts-expect-error empty domains
    Css.marker({ state: [] })
    // @ts-expect-error serialization ambiguity
    Css.marker({ state: [false, 'false'] })
  })
})
