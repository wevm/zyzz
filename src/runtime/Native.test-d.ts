/** Checks finite native selection inputs and native props through the public runtime. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import type { StyleSheet } from 'zyzz/react-native'
import { Native } from 'zyzz/runtime'

describe('create', () => {
  test('retains caller-owned object types through application and composition', () => {
    const card = Native.create({
      axes: {},
      defaults: {},
      styles: { 0: { opacity: 0.2 } },
    })
    const value = { current: 0.5 }
    const color = { resource: Symbol('native-color') }
    const override = { opacity: value, color }
    const props = card({ style: [false, [override]] })
    expectTypeOf(props).toEqualTypeOf<
      Native.Props<{ readonly opacity: 0.2 } | typeof override>
    >()
    expectTypeOf(Native.compose(card(), false, props)).toEqualTypeOf<
      Native.Props<{ readonly opacity: 0.2 } | typeof override>
    >()
    expectTypeOf(Native.compose({ style: override })).toEqualTypeOf<
      Native.Props<typeof override>
    >()
    expectTypeOf(Native.compose()).not.toBeAny()
    // @ts-expect-error Native style overrides are objects or nested style arrays.
    card({ style: 'web-class' })
  })

  test('retains finite choices, booleans, nulls and native overrides', () => {
    const card = Native.create({
      axes: { size: ['small', 'large'], active: ['true', 'false'] },
      defaults: { size: 'small', active: 'false' },
      styles: {} as Readonly<Record<string, StyleSheet.NativeStyle>>,
    })
    expectTypeOf(card()).toEqualTypeOf<Native.Props>()
    card({ size: 'large', active: true })
    card({ size: null, active: undefined, style: [false, [{ opacity: 0.5 }]] })
    // @ts-expect-error Only declared choices are accepted.
    card({ size: 'huge' })
    // @ts-expect-error Boolean axes accept booleans.
    card({ active: 'true' })
    // @ts-expect-error Web classes do not belong to native props.
    card({ className: 'external' })
    // @ts-expect-error Unknown axes are rejected.
    card({ unknown: 'value' })
    expectTypeOf(
      Native.compose(card(), false, card({ size: 'small' })),
    ).toEqualTypeOf<Native.Props>()
  })
})
