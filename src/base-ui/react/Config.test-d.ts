/** Checks configured Base UI tokens, shorthands, and React output. @module */
import { Select } from '@base-ui/react/select'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { defineVars, type style as rootStyle } from 'zyzz'
import { defineConfig } from 'zyzz/base-ui/react'
import { tokens } from 'zyzz/default'

describe('defineConfig', () => {
  test('retains default token strings for component states', () => {
    const { style } = defineConfig({ id: 'default', vars: tokens })
    const item = style(Select.Item, {
      padding: 7,
      states: { highlighted: { color: 'blue.900' } },
    })

    expectTypeOf(item()).toEqualTypeOf<rootStyle.Props>()
    style(Select.Item, {
      states: {
        highlighted: {
          // @ts-expect-error Default token names remain checked in states.
          color: 'blue.999',
        },
      },
    })
  })

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
    style(Select.Item, {
      states: {
        // @ts-expect-error Configured styles reject misspelled state names.
        higlighted: { color: 'ink' },
      },
    })
    style(Select.Item, {
      states: {
        // @ts-expect-error Configured states remain specific to the component part.
        side: { bottom: { color: 'ink' } },
      },
    })
    style(Select.Popup, {
      states: {
        side: {
          // @ts-expect-error Configured placement states reject misspelled values.
          botom: { color: 'ink' },
        },
      },
    })
    style(Select.Item, {
      states: {
        highlighted: {
          // @ts-expect-error Unknown configured color token.
          color: 'missing',
        },
      },
    })
    style(Select.Item, {
      states: {
        selected: {
          // @ts-expect-error Shorthands preserve their configured domains.
          px: 'ink',
        },
      },
    })
    style(Select.Item, {
      states: {
        selected: {
          // @ts-expect-error State branches only accept configured layers.
          '@layer missing': {},
        },
      },
    })
    defineConfig({
      // @ts-expect-error Unknown configuration options are rejected.
      missing: true,
    })
    defineConfig({
      // @ts-expect-error The integration produces React props.
      output: 'html',
    })
  })
})
