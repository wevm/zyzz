/** Checks native variable inference and Provider selection props. @module */
import { Config, Vars } from 'zyzz'
import { Provider, useVars } from 'zyzz/react-native/react'
import type { StyleSheet } from 'zyzz/react-native'
import { describe, expectTypeOf, test } from 'vite-plus/test'

describe('Provider', () => {
  test('accepts vars and resolved schemes', () => {
    const props: Provider.Props = { colorScheme: 'dark', vars: 'blue' }
    expectTypeOf(props.vars).toEqualTypeOf<string | undefined>()
    // @ts-expect-error The selection prop is vars.
    Provider({ colorScheme: 'light', set: 'blue' })
    // @ts-expect-error Native appearance must be resolved.
    Provider({ colorScheme: 'system' })
    Provider({ colorScheme: 'light' })
  })
})

describe('useVars', () => {
  test('infers readonly native scalar domains and selected results', () => {
    const { vars } = Config.create({
      vars: {
        color: { ink: { light: '#123456', dark: '#abcdef' } },
        spacing: { gap: '1rem' },
        typography: {
          body: {
            fontFamily: 'Pilat',
            fontSize: '1rem',
            fontWeight: 500,
            lineHeight: 1.25,
          },
        },
      },
    })
    const values = useVars(vars)
    expectTypeOf(values.color.ink).toEqualTypeOf<string>()
    expectTypeOf(values.spacing.gap).toEqualTypeOf<number>()
    expectTypeOf(values.typography.body.fontSize).toEqualTypeOf<number>()
    expectTypeOf(values.typography.body.fontFamily).toEqualTypeOf<string>()
    expectTypeOf(values.typography.body.lineHeight).toEqualTypeOf<number>()
    expectTypeOf(values.typography.body.fontWeight).toEqualTypeOf<
      Exclude<StyleSheet.NativeStyle['fontWeight'], undefined>
    >()
    expectTypeOf(useVars(vars, undefined)).toEqualTypeOf<typeof values>()
    expectTypeOf(
      useVars(vars, (values) => values.color.ink),
    ).toEqualTypeOf<string>()
    expectTypeOf(useVars(vars, (values) => values.spacing)).toEqualTypeOf<{
      readonly gap: number
    }>()
    // @ts-expect-error Resolved values remain readonly.
    values.spacing.gap = 20
    // @ts-expect-error Selectors retain the authored paths.
    useVars(vars, (values) => values.spacing.missing)
    // @ts-expect-error A config is not its vars helper.
    useVars(Config.create({ vars: { spacing: { gap: '1px' } } }))
    // @ts-expect-error Plain objects are not portable variable definitions.
    useVars({ spacing: { gap: '1px' } })
  })

  test('preserves named configuration shape and standalone variables', () => {
    const { vars } = Config.create({
      defaultVars: 'blue',
      vars: {
        blue: { color: { ink: '#123456' } },
        green: { color: { ink: '#abcdef' } },
      },
    })
    expectTypeOf(useVars(vars)).toEqualTypeOf<{
      readonly color: { readonly ink: string }
    }>()
    const standalone = Vars.define({ spacing: { gap: '4px' } })
    expectTypeOf(useVars(standalone).spacing.gap).toEqualTypeOf<number>()
  })
})
