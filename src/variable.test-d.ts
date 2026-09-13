/** Checks scalar references, assignment domains, and nested authoring through public APIs. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { css, variable } from 'zyzz'

describe('variable', () => {
  test('infers independent references and inline assignments', () => {
    const accent = variable('color')
    const gap = variable('length')
    const amount = variable('percentage')
    const count = variable('number')
    const signed = variable('signedLength')

    css({
      color: accent,
      padding: gap,
      width: amount,
      opacity: count,
      marginLeft: signed,
    })
    css({
      variables: { [accent]: 'tomato', [gap]: '12px' },
      selectors: { '&:hover': { variables: { [accent]: 'purple' } } },
    })
    css({ width: `calc(${gap} * 2)` })
    const style = css({ color: accent })
    style({ style: { ...accent.set('blue'), ...gap.set('12px') } })
    expectTypeOf(accent.set('blue')).toEqualTypeOf<
      Readonly<Record<`--${string}`, 'blue'>>
    >()
    const set = amount.set
    set('50%')

    // @ts-expect-error Color assignments reject lengths.
    accent.set('12px')
    // @ts-expect-error Hash colors require hexadecimal digits.
    accent.set('#nothex')
    // @ts-expect-error Lengths exclude percentages.
    gap.set('50%')
    // @ts-expect-error Unsigned lengths exclude negative values.
    gap.set('-12px')
    // @ts-expect-error Percentages require CSS numeric spelling.
    amount.set('0x10%')
    // @ts-expect-error Unsigned percentages exclude negative values.
    amount.set('-50%')
    // @ts-expect-error Color references cannot provide a width.
    css({ width: accent })
    // @ts-expect-error Signed lengths cannot guarantee nonnegative padding.
    css({ padding: signed })
    // @ts-expect-error Unconstrained numbers cannot guarantee integer z-index.
    css({ zIndex: count })
    // @ts-expect-error Grid lines require nonzero integers.
    css({ gridColumnStart: count })
    // @ts-expect-error A font shorthand also requires a family.
    css({ font: gap })
    // @ts-expect-error Shadow grammar requires more than one length.
    css({ boxShadow: gap })
    // @ts-expect-error Declarations remain typed inside selectors.
    css({ selectors: { '&:hover': { width: accent } } })
    // @ts-expect-error Variables contain scalar assignments.
    css({ variables: { [accent]: { color: 'red' } } })
    // @ts-expect-error Only supported scalar domains are accepted.
    variable('anything')
  })
})
