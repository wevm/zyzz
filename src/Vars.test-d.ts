/** Checks explicit variable names, scalar domains, and assignment inference. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { css, Vars } from 'zyzz'

describe('define', () => {
  test('accepts string zero for registered lengths', () => {
    Vars.define({
      gap: { type: 'length', inherits: false, initialValue: '0' },
      offset: { type: 'signedLength', inherits: false, initialValue: '0' },
    })
  })
  test('reserves the assignment method name', () => {
    // @ts-expect-error The contract owns the set method.
    Vars.define({ set: 'number' })
  })

  test('distinguishes signed dimensions and grid integers', () => {
    const slots = Vars.define({
      size: 'length',
      signed: 'signedLength',
      amount: 'percentage',
      count: 'number',
    })
    slots.set({ size: '12px', signed: '-12px', amount: '50%' })
    css({ marginLeft: slots.signed, padding: slots.size })
    // @ts-expect-error Nonnegative lengths cannot carry negative values.
    slots.set({ size: '-12px' })
    // @ts-expect-error Nonnegative percentages cannot carry negative values.
    slots.set({ amount: '-50%' })
    // @ts-expect-error Signed dimensions cannot guarantee nonnegative padding.
    css({ padding: slots.signed })
    // @ts-expect-error Grid lines require nonzero integers.
    css({ gridColumnStart: slots.count })
  })

  test('rejects partial compound grammars', () => {
    const slots = Vars.define({ size: 'length', count: 'number' })
    // @ts-expect-error A font shorthand also requires a family.
    css({ font: slots.size })
    // @ts-expect-error A shadow needs multiple lengths.
    css({ boxShadow: slots.size })
    // @ts-expect-error Numbers alone cannot describe a font shorthand.
    css({ font: slots.count })
  })

  test('rejects malformed assignments and constrained numeric properties', () => {
    const slots = Vars.define({
      color: 'color',
      amount: 'percentage',
      count: 'number',
    })
    // @ts-expect-error CSS percentages use decimal numeric spelling.
    slots.set({ amount: '0x10%' })
    // @ts-expect-error Color hashes require hexadecimal digits.
    slots.set({ color: '#nothex' })
    // @ts-expect-error Generic numeric slots cannot guarantee integer z-index values.
    css({ zIndex: slots.count })
  })
  test('infers references and rejects incompatible declarations', () => {
    const vars = Vars.define({
      amount: 'percentage',
      color: 'color',
      count: 'number',
      gap: 'length',
    })
    css({
      '--accent': vars.color,
      color: vars.color,
      opacity: vars.count,
      padding: vars.gap,
      width: vars.amount,
    })
    // @ts-expect-error Length slots exclude percentage assignments.
    vars.set({ gap: '50%' })
    // @ts-expect-error Color variables do not supply lengths.
    css({ width: vars.color })
    // @ts-expect-error Unknown schema types cannot be declared.
    Vars.define({ bad: 'anything' })
  })
})
describe('set', () => {
  test('excludes implicitly constrained numeric and signed grammars', () => {
    const vars = Vars.define({
      size: 'signedLength',
      ratio: 'signedPercentage',
      count: 'number',
    })
    // @ts-expect-error Border widths are implicitly nonnegative.
    css({ border: vars.size })
    // @ts-expect-error Outline widths are implicitly nonnegative.
    css({ outline: vars.size })
    // @ts-expect-error Grid track breadths are implicitly nonnegative.
    css({ gridTemplateColumns: vars.size })
    // @ts-expect-error Grid percentage tracks are implicitly nonnegative.
    css({ gridAutoRows: vars.ratio })
    // @ts-expect-error Aspect ratios cannot accept arbitrary signed numbers.
    css({ aspectRatio: vars.count })
  })
  test('excludes percentage bindings from length-only number rules', () => {
    const vars = Vars.define({ size: 'percentage' })
    // @ts-expect-error Tab size accepts lengths and integers, not percentages.
    css({ tabSize: vars.size })
  })
  test('excludes minimum constrained signed bindings', () => {
    const vars = Vars.define({
      size: 'signedLength',
      ratio: 'signedPercentage',
    })
    // @ts-expect-error Line height cannot accept arbitrary signed lengths.
    css({ lineHeight: vars.size })
    // @ts-expect-error Line height cannot accept arbitrary signed percentages.
    css({ lineHeight: vars.ratio })
  })
  test('checks partial assignments and rejects unknown names', () => {
    const vars = Vars.define({ amount: 'percentage', count: 'number' })
    expectTypeOf(vars.set({ amount: '50%' })).toEqualTypeOf<
      Readonly<Record<`--${string}`, number | string>>
    >()
    vars.set({ count: 2 })
    // @ts-expect-error Values retain the declared percentage domain.
    vars.set({ amount: '20px' })
    // @ts-expect-error Unknown slots cannot be assigned.
    vars.set({ missing: 1 })
  })
})
