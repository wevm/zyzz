/** Verifies public native animation selections and shared-value inference. @module */
import { Config, Vars } from 'zyzz'
import {
  useAnimatedStyleValue,
  useAnimatedVars,
} from 'zyzz/react-native/reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { describe, expectTypeOf, test } from 'vite-plus/test'

describe('useAnimatedVars', () => {
  test('infers native values and selector results', () => {
    const { vars } = Config.create({
      vars: { color: { ink: '#123456' }, spacing: { gap: '8px' } },
    })

    expectTypeOf(
      useAnimatedVars(vars, (values) => values.color.ink),
    ).toEqualTypeOf<SharedValue<string>>()
    expectTypeOf(
      useAnimatedVars(vars, (values) => values.spacing.gap),
    ).toEqualTypeOf<SharedValue<number>>()
    expectTypeOf(
      useAnimatedVars(vars, (values) => values.spacing.gap).get(),
    ).toEqualTypeOf<number>()
    expectTypeOf(useAnimatedVars(vars)).toEqualTypeOf<
      SharedValue<{
        readonly color: { readonly ink: string }
        readonly spacing: { readonly gap: number }
      }>
    >()
    const standalone = Vars.define({ spacing: { gap: '8px' } })
    expectTypeOf(
      useAnimatedVars(standalone, (values) => values.spacing.gap),
    ).toEqualTypeOf<SharedValue<number>>()
    // @ts-expect-error Selectors cannot publish functions to worklets.
    useAnimatedVars(vars, () => () => 1)
    // @ts-expect-error Selectors retain the variable paths.
    useAnimatedVars(vars, (values) => values.color.missing)
    // @ts-expect-error Breakpoints are compilation metadata.
    useAnimatedVars(vars, (values) => values.breakpoint)
  })
})

describe('useAnimatedStyleValue', () => {
  test('infers numeric and color properties and accepts composed styles', () => {
    expectTypeOf(
      useAnimatedStyleValue([{ width: 10 }, { width: 20 }], 'width'),
    ).toEqualTypeOf<SharedValue<number>>()
    expectTypeOf(
      useAnimatedStyleValue({ width: 20 }, 'width').get(),
    ).toEqualTypeOf<number>()
    expectTypeOf(
      useAnimatedStyleValue({ backgroundColor: 'red' }, 'backgroundColor'),
    ).toEqualTypeOf<SharedValue<string>>()
    // @ts-expect-error Structured properties do not have scalar animation bindings.
    useAnimatedStyleValue({ transform: [{ scale: 2 }] }, 'transform')
    // @ts-expect-error String layout modes are not numeric or color properties.
    useAnimatedStyleValue({ display: 'none' }, 'display')
    // @ts-expect-error Property names belong to native styles.
    useAnimatedStyleValue({}, 'missing')
  })
})
