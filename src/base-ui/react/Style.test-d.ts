/** Checks component-first inference through the opt-in public entrypoint. @module */
import { Menu } from '@base-ui/react/menu'
import { Select } from '@base-ui/react/select'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { style as rootStyle } from 'zyzz'
import { style } from 'zyzz/base-ui/react'

describe('style', () => {
  test('checks state names, values, and declarations without restricting selectors', () => {
    const item = style(Select.Item, {
      color: 'black',
      selectors: {
        '&[data-higlighted]': { color: 'red' },
        '&[data-custom] > span': { color: 'blue' },
      },
      states: {
        highlighted: { backgroundColor: 'blue' },
        selected: { ':hover': { color: 'white' } },
      },
    })
    style(Select.Popup, {
      states: {
        side: { bottom: { marginTop: '8px' }, top: { marginBottom: '4px' } },
      },
    })
    style(Select.Trigger, {
      states: { popupSide: { left: { paddingLeft: '2px' } } },
    })
    style(Menu.Item, { states: { highlighted: { color: 'blue' } } })

    expectTypeOf(item()).toEqualTypeOf<rootStyle.Props>()
    // @ts-expect-error Misspelled documented state.
    style(Select.Item, { states: { higlighted: { color: 'red' } } })
    // @ts-expect-error Item does not have popup placement states.
    style(Select.Item, { states: { side: { bottom: { color: 'red' } } } })
    // @ts-expect-error Placement values are checked.
    style(Select.Popup, { states: { side: { botom: { color: 'red' } } } })
    // @ts-expect-error State declarations retain CSS value validation.
    style(Select.Item, { states: { highlighted: { display: 'invalid' } } })
    style(Select.Item, {
      // @ts-expect-error Nested states are checked too.
      selectors: { '&:hover': { states: { missing: {} } } },
    })
    // @ts-expect-error The component-first overload is opt-in.
    rootStyle(Select.Item, { color: 'red' })
    // @ts-expect-error Component-first callbacks are not supported.
    style(Select.Item, () => ({ color: 'red' }))
    // @ts-expect-error Arbitrary components do not receive Base UI states.
    style((_props: { className?: string }) => null, {
      states: { highlighted: {} },
    })
  })

  test('retains ordinary static, composition, and dynamic overloads', () => {
    const ordinary = style({ color: 'red' })
    const composed = style([ordinary, { padding: '4px' }])
    const dynamic = style((values: { opacity: number }) => ({
      opacity: values.opacity,
    }))

    expectTypeOf(composed()).toEqualTypeOf<rootStyle.Props>()
    expectTypeOf(dynamic({ opacity: 0.5 })).toEqualTypeOf<rootStyle.Props>()
  })
})
