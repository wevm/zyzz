/** Verifies registered variable domains and computationally independent defaults. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Vars, css } from 'zyzz'

describe('define', () => {
  test('rejects unknown registration descriptor keys', () => {
    Vars.define({
      gap: {
        type: 'length',
        inherits: false,
        initialValue: '4px',
        // @ts-expect-error descriptor keys are exact through generic inference
        initial: '8px',
      },
    })
  })
  test('preserves scalar assignment types for registration descriptors', () => {
    Vars.define({
      // @ts-expect-error currentcolor is element-dependent in every supported spelling
      color: { type: 'color', inherits: false, initialValue: 'currentcolor' },
    })
    Vars.define({
      color: {
        type: 'color',
        inherits: false,
        // @ts-expect-error nested currentcolor remains element-dependent
        initialValue: 'color-mix(in srgb, currentColor, red)',
      },
    })

    const vars = Vars.define({
      amount: { type: 'percentage', inherits: false, initialValue: '0%' },
      gap: { type: 'length', inherits: true, initialValue: '4px' },
      count: 'number',
    })

    expectTypeOf(vars.amount).toHaveProperty('name')

    vars.set({ amount: '25%', gap: '8px', count: 2 })
    css({ width: vars.amount, padding: vars.gap })
    // @ts-expect-error runtime values retain their scalar domain
    vars.set({ amount: 25 })
    Vars.define({
      // @ts-expect-error relative initial lengths are not computationally independent
      gap: { type: 'length', inherits: true, initialValue: '1em' },
    })
    Vars.define({
      gap: {
        type: 'length',
        // @ts-expect-error syntax must match the scalar domain
        syntax: '<color>',
        inherits: true,
        initialValue: '4px',
      },
    })
  })
})

describe('define', () => {
  test('reserves prototype keys in variable schemas', () => {
    // @ts-expect-error prototype syntax cannot define an assignable own slot
    Vars.define({ __proto__: 'length' })
  })
})

describe('define', () => {
  test('keeps unsigned registration defaults nonnegative', () => {
    Vars.define({
      // @ts-expect-error unsigned length defaults cannot be negative
      gap: { type: 'length', inherits: false, initialValue: '-1px' },
    })
    Vars.define({
      gap: { type: 'signedLength', inherits: false, initialValue: '-1px' },
    })
  })
})
