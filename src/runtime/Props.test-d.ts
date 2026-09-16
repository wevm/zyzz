/**
 * Checks consumer inference and rejected inputs through the public Props API.
 * @module
 */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { style } from 'zyzz'
import { Props } from 'zyzz/runtime'

describe('create', () => {
  test('infers applied props and rejects unrelated attributes', () => {
    const button = Props.create({ className: 'button' })

    expectTypeOf(button).toEqualTypeOf<style.ReturnType>()
    expectTypeOf(button().className).toEqualTypeOf<string>()

    button({ className: 'external', style: { paddingLeft: '2px' } })
    // @ts-expect-error Component attributes are not styling overrides.
    button({ id: 'button' })
    // @ts-expect-error Variant attributes cannot be supplied directly.
    button({ 'data-size': 'large' })
    // @ts-expect-error Only string class names are accepted.
    button({ className: [] })

    const attributes = { className: 'external', id: 'button' }

    // @ts-expect-error Unknown keys remain errors when passed through variables.
    button(attributes)
  })
})
