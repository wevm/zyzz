/** Checks finite native selection inputs and native props through the public runtime. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Native } from 'zyzz/runtime'

describe('create', () => {
  test('retains finite choices, booleans, nulls and native overrides', () => {
    const card = Native.create({
      axes: { size: ['small', 'large'], active: ['true', 'false'] },
      defaults: { size: 'small', active: 'false' },
      styles: {},
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
