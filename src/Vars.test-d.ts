/** Checks explicit variable names, scalar domains, and assignment inference. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { css, Vars } from 'zyzz'

describe('define', () => {
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
