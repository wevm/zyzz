/** Checks explicit variable names, scalar domains, and assignment inference. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { css, Vars } from 'zyzz'

describe('define', () => {
  test('distinguishes signed dimensions and grid integers', () => {
    const slots = Vars.define({
      size: 'length',
      signed: 'signedLength',
      amount: 'percentage',
      count: 'number',
    })
    Vars.set(slots, { size: '12px', signed: '-12px', amount: '50%' })
    css({ marginLeft: slots.signed, padding: slots.size })
    // @ts-expect-error Nonnegative lengths cannot carry negative values.
    Vars.set(slots, { size: '-12px' })
    // @ts-expect-error Nonnegative percentages cannot carry negative values.
    Vars.set(slots, { amount: '-50%' })
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
    Vars.set(slots, { amount: '0x10%' })
    // @ts-expect-error Color hashes require hexadecimal digits.
    Vars.set(slots, { color: '#nothex' })
    // @ts-expect-error Generic numeric slots cannot guarantee integer z-index values.
    css({ zIndex: slots.count })
  })
  test('infers references and rejects incompatible declarations', () => {
    const progress = Vars.define({
      amount: 'percentage',
      color: 'color',
      count: 'number',
      gap: 'length',
    })
    css({
      '--accent': progress.color,
      color: progress.color,
      opacity: progress.count,
      padding: progress.gap,
      width: progress.amount,
    })
    // @ts-expect-error Length slots exclude percentage assignments.
    Vars.set(progress, { gap: '50%' })
    // @ts-expect-error Color variables do not supply lengths.
    css({ width: progress.color })
    // @ts-expect-error Unknown schema types cannot be declared.
    Vars.define({ bad: 'anything' })
  })
})
describe('set', () => {
  test('checks partial assignments and rejects unknown names', () => {
    const progress = Vars.define({ amount: 'percentage', count: 'number' })
    expectTypeOf(Vars.set(progress, { amount: '50%' })).toEqualTypeOf<
      Readonly<Record<`--${string}`, number | string>>
    >()
    Vars.set(progress, { count: 2 })
    // @ts-expect-error Values retain the declared percentage domain.
    Vars.set(progress, { amount: '20px' })
    // @ts-expect-error Unknown slots cannot be assigned.
    Vars.set(progress, { missing: 1 })
  })
})
