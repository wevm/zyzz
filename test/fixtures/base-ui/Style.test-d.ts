/** Checks the proposed component overload against real Base UI declarations. @module */
import { Select } from '@base-ui/react/select'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import type { style as rootStyle } from 'zyzz'
import { style } from './Style.js'

describe('style', () => {
  test('preserves callable props and unrestricted CSS selectors', () => {
    const item = style(Select.Item, {
      color: 'red',
      selectors: {
        '&[data-highlighted]': { color: 'blue' },
        '&[data-app-state="busy"] > span': { opacity: 0.5 },
      },
    })

    expectTypeOf(item).toEqualTypeOf<rootStyle.ReturnType>()
    expectTypeOf(item()).toExtend<Select.Item.Props>()
    expectTypeOf(style({ color: 'red' })).toEqualTypeOf<rootStyle.ReturnType>()
    expectTypeOf(
      style({ color: 'red' }, { id: 'plain' }),
    ).toEqualTypeOf<rootStyle.ReturnType>()
  })

  test('retains literal validation in component and nested styles', () => {
    const arbitrary = {
      selectors: { '&[data-app-state]': { display: 'invalid' } },
    } as const
    const known = {
      selectors: { '&[data-highlighted]': { opacity: false } },
    } as const

    // @ts-expect-error Component hints must not weaken CSS value validation.
    style(Select.Item, { display: 'not-a-display' })
    // @ts-expect-error Known selectors still validate their declarations.
    style(Select.Item, known)
    // @ts-expect-error Arbitrary selectors still validate their declarations.
    style(Select.Popup, arbitrary)
    // @ts-expect-error Unknown properties remain errors.
    style(Select.Trigger, { colro: 'red' })
  })
})
