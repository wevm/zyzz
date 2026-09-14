/** Checks scalar references, assignment domains, and nested authoring through public APIs. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config, css, variable } from 'zyzz'

describe('variable', () => {
  test('accepts untyped references and scalar inline values', () => {
    const value = variable()

    css({
      color: value,
      width: value,
      display: value,
      boxShadow: value,
      zIndex: value,
    })
    css({
      variables: { [value]: 'inline-flex' },
      selectors: { '&:hover': { display: value } },
    })
    css({ width: `calc(${value} * 2)` })
    value.set('inline-flex')
    value.set('1px 2px red')
    value.set(42)
    const style = css({ display: value })
    style({ variables: { [value]: 'grid' } })
    style({ variables: { [value]: undefined } })
    const dynamic = css((input: { opacity: number }) => ({
      opacity: input.opacity,
    }))
    dynamic({ opacity: 0.5, variables: { [value]: 42 } })
    const { css: htmlCss } = Config.create({ output: 'html' })
    htmlCss({ display: value })({ variables: { [value]: 'flex' } })

    // @ts-expect-error Variable assignments must be scalar.
    style({ variables: { [value]: true } })
    // @ts-expect-error Literal variable names must be custom properties.
    style({ variables: { color: 'red' } })
    // @ts-expect-error Variable assignments are a reserved styling override.
    css((input: { variables: number }) => ({ opacity: input.variables }))
    expectTypeOf(value.set('blue')).toEqualTypeOf<
      Readonly<Record<`--${string}`, 'blue'>>
    >()

    // @ts-expect-error Assignments still require a scalar.
    value.set({ color: 'red' })
    // @ts-expect-error Registration requires an explicit domain.
    variable({ inherits: true, initialValue: 'red' })
  })

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

describe('registered', () => {
  describe('variable', () => {
    test('registers independent defaults and retains assignment domains', () => {
      variable('length', { inherits: true, initialValue: '0' })
      variable('signedLength', { inherits: false, initialValue: '-1px' })
      const gap = variable('length', {
        inherits: true,
        initialValue: '4px',
        syntax: '<length>',
      })
      gap.set('8px')

      // @ts-expect-error Options require both registration fields.
      variable('color', { initialValue: 'red' })
      // @ts-expect-error Unknown registration options are rejected.
      variable('length', {
        inherits: true,
        initialValue: '4px',
        initial: '8px',
      })
      const mismatched = {
        inherits: true,
        initialValue: '4px',
        syntax: '<color>',
      } as const
      // @ts-expect-error Syntax must match the variable domain.
      variable('length', mismatched)
      // @ts-expect-error Initial values must be computationally independent.
      variable('length', { inherits: false, initialValue: '1em' })
      // @ts-expect-error Unsigned defaults remain nonnegative.
      variable('length', { inherits: false, initialValue: '-1px' })
      // @ts-expect-error currentColor is not independent.
      variable('color', { inherits: false, initialValue: 'currentcolor' })
      const dependent = {
        inherits: false,
        initialValue: 'color-mix(in srgb, currentColor, red)',
      } as const
      // @ts-expect-error Nested currentColor is not independent.
      variable('color', dependent)
      // @ts-expect-error Assignments retain their declared domain.
      gap.set('red')
    })
  })
})
