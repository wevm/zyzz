/** Checks configured Base UI tokens, shorthands, and React output. @module */
import { Select } from '@base-ui/react/select'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { defineVars, type style as rootStyle } from 'zyzz'
import { defineConfig } from 'zyzz/base-ui/react'

describe('defineConfig', () => {
  test('preserves configured token domains inside state branches', () => {
    const base = defineVars({
      color: { ink: 'black' },
      spacing: { gap: '4px' },
    })
    const { style, vars, variants } = defineConfig({
      defaultVars: 'base',
      layers: ['components'],
      shorthands: { px: ['paddingLeft', 'paddingRight'] },
      vars: { base },
    })
    const item = style(Select.Item, {
      color: 'ink',
      px: 'gap',
      states: { highlighted: { color: vars.color.ink, px: 'gap' } },
    })
    style({ color: 'ink' })
    variants({ base: { color: 'ink' } })
    style(Select.Item, {
      states: { selected: { '@layer components': { color: 'ink' } } },
    })
    style(Select.Popup, {
      states: { side: { bottom: { color: 'ink', px: 'gap' } } },
    })

    expectTypeOf(item()).toEqualTypeOf<rootStyle.Props>()
    // @ts-expect-error Configured styles reject misspelled state names.
    style(Select.Item, { states: { higlighted: { color: 'ink' } } })
    // @ts-expect-error Configured states remain specific to the component part.
    style(Select.Item, { states: { side: { bottom: { color: 'ink' } } } })
    // @ts-expect-error Configured placement states reject misspelled values.
    style(Select.Popup, { states: { side: { botom: { color: 'ink' } } } })
    // @ts-expect-error Unknown configured color token.
    style(Select.Item, { states: { highlighted: { color: 'missing' } } })
    // @ts-expect-error Shorthands preserve their configured domains.
    style(Select.Item, { states: { selected: { px: 'ink' } } })
    // @ts-expect-error State branches only accept configured layers.
    style(Select.Item, { states: { selected: { '@layer missing': {} } } })
    // @ts-expect-error Unknown configuration options are rejected.
    defineConfig({ missing: true })
    // @ts-expect-error The integration produces React props.
    defineConfig({ output: 'html' })
  })
})
