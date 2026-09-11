/** Checks marker state inference and relationship-key authoring without broad state domains. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { css } from 'zyzz'
import { Css, global } from 'zyzz/web'
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
    const arbitrary = Symbol()
    // @ts-expect-error arbitrary symbols are not relationship keys
    css({ [arbitrary]: { color: 'red' } })
    // @ts-expect-error descendant has would require forbidden nested :has
    Css.descendant(card, { has: 'a' })
    // @ts-expect-error following-sibling has would require forbidden nested :has
    Css.siblingAfter(card, { has: 'a' })
    // @ts-expect-error invalid state-name characters
    Css.marker({ 'not ok': ['open'] })
    // @ts-expect-error case-folded duplicate names
    Css.marker({ State: ['open'], state: ['closed'] })
    Css.marker(undefined)
    Css.ancestor(card, { data: undefined })
    css((values: { color: '#123' | '#456' }) => ({
      [Css.ancestor(card)]: { color: values.color },
    }))
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

test('excludes marker relationships from global declarations', () => {
  const card = Css.marker()
  // @ts-expect-error global rules cannot contain marker relationship keys
  global({ body: { [Css.ancestor(card)]: { color: 'red' } } })
})
