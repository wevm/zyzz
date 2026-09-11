/** Verifies registered variable domains and computationally independent defaults. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Vars, css } from 'zyzz'
describe('define', () => {
  test('preserves scalar assignment types for registration descriptors', () => {
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
