/** Checks finite fragment selection inference through the public native runtime. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import type { StyleSheet } from 'zyzz/react-native'
import { Native, NativeStatic } from 'zyzz/runtime'

describe('create', () => {
  test('retains literal axes, boolean choices, nulls, and native overrides', () => {
    const card = NativeStatic.create({
      axes: { active: ['true', 'false'], size: ['small', 'large'] },
      defaults: { active: 'false', size: 'small' },
      rules: [{ matches: [], steps: ['base'] }],
      styles: { base: { opacity: 0.2 } },
    })

    expectTypeOf(card()).toEqualTypeOf<Native.Props>()
    card({ active: true, size: 'large' })
    card({ active: undefined, size: null })
    const override = { color: { resource: Symbol('native-color') } }
    expectTypeOf(card({ style: [false, [override]] })).toEqualTypeOf<
      Native.Props<StyleSheet.NativeStyle | typeof override>
    >()
    // @ts-expect-error Only declared choices are accepted.
    card({ size: 'huge' })
    // @ts-expect-error Boolean axes accept booleans.
    card({ active: 'true' })
    // @ts-expect-error Unknown axes are rejected.
    card({ unknown: 'value' })
    // @ts-expect-error Web classes do not belong to native props.
    card({ className: 'external' })
    // @ts-expect-error Native overrides are objects or nested style arrays.
    card({ style: 'web-class' })
  })
})
