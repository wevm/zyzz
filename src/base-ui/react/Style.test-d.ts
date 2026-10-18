/** Checks component-first inference through the opt-in public entrypoint. @module */
import { Accordion } from '@base-ui/react/accordion'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Autocomplete } from '@base-ui/react/autocomplete'
import { Dialog } from '@base-ui/react/dialog'
import { Drawer } from '@base-ui/react/drawer'
import { Fieldset } from '@base-ui/react/fieldset'
import { Menu } from '@base-ui/react/menu'
import { Popover } from '@base-ui/react/popover'
import { Select } from '@base-ui/react/select'
import { Slider } from '@base-ui/react/slider'
import { Toast } from '@base-ui/react/toast'
import { Toolbar } from '@base-ui/react/toolbar'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { style as rootStyle } from 'zyzz'
import { style } from 'zyzz/base-ui/react'

describe('style', () => {
  test('covers generic, inherited, and aliased parts without leaking sibling states', () => {
    style(Dialog.Trigger, { states: { popupOpen: { color: 'red' } } })
    style(AlertDialog.Trigger, { states: { popupOpen: { color: 'red' } } })
    style(Popover.Trigger, { states: { popupOpen: { color: 'red' } } })
    style(Autocomplete.Clear, { states: { visible: { color: 'red' } } })
    style(Toolbar.Separator, {
      states: { orientation: { vertical: { color: 'red' } } },
    })
    style(Accordion.Item, {
      states: { index: { 0: { color: 'red' }, '-1': { color: 'blue' } } },
    })
    style(Slider.Thumb, { states: { index: { 2: { opacity: 0.5 } } } })
    style(Toast.Root, {
      states: {
        type: { 'custom/toast': { color: 'blue' } },
        expanded: { opacity: 1 },
      },
    })
    style(Popover.Viewport, {
      states: {
        activationDirection: { 'left ': { opacity: 0.5 }, ' ': { opacity: 1 } },
        current: { color: 'red' },
      },
    })
    style(Fieldset.Root, { states: { disabled: { opacity: 0.5 } } })
    style(Drawer.Indent, { states: { inactive: { opacity: 1 } } })

    style(Dialog.Trigger, {
      states: {
        // @ts-expect-error Generic triggers still check state names.
        popupOpne: {},
      },
    })
    style(Popover.Trigger, {
      states: {
        // @ts-expect-error A callable-interface trigger still checks its own states.
        selected: {},
      },
    })
    style(Drawer.Popup, {
      states: {
        // @ts-expect-error Drawer.Popup must not inherit Dialog.Popup-only states.
        nestedDialogOpen: {},
      },
    })
    style(Dialog.Popup, {
      states: {
        // @ts-expect-error Dialog.Popup does not acquire its derived Drawer.Popup states.
        swiping: {},
      },
    })
    style(Menu.Separator, {
      states: {
        // @ts-expect-error A separator must not acquire Toolbar.Root's disabled state.
        disabled: {},
      },
    })
    style(Autocomplete.Clear, {
      states: {
        // @ts-expect-error Aliases do not acquire unrelated item states.
        selected: {},
      },
    })
    style(Slider.Thumb, {
      states: {
        index: {
          // @ts-expect-error Numeric attribute keys cannot be arbitrary words.
          first: {},
        },
      },
    })
    style(Toast.Root, {
      states: {
        type: {
          custom: {
            // @ts-expect-error String-valued states still validate their CSS bodies.
            display: 'invalid',
          },
        },
      },
    })
    style(Toast.Root, {
      states: {
        expanded: {
          // @ts-expect-error Boolean state metadata describes presence, not a true/false map.
          true: {},
        },
      },
    })
    style(Popover.Viewport, {
      states: {
        activationDirection: {
          // @ts-expect-error Viewport direction preserves the space separating both axes.
          left: {},
        },
      },
    })
    // @ts-expect-error A provider has no DOM styling contract.
    style(Toast.Provider, { color: 'red' })
  })

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
    style(Select.Item, {
      states: {
        // @ts-expect-error Misspelled documented state.
        higlighted: { color: 'red' },
      },
    })
    style(Select.Item, {
      states: {
        // @ts-expect-error Item does not have popup placement states.
        side: { bottom: { color: 'red' } },
      },
    })
    style(Select.Popup, {
      states: {
        side: {
          // @ts-expect-error Placement values are checked.
          botom: { color: 'red' },
        },
      },
    })
    style(Select.Item, {
      states: {
        highlighted: {
          // @ts-expect-error State declarations retain CSS value validation.
          display: 'invalid',
        },
      },
    })
    style(Select.Item, {
      selectors: {
        '&:hover': {
          states: {
            // @ts-expect-error Nested states are checked too.
            missing: {},
          },
        },
      },
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
