/** Checks dynamic callable inference and exact required runtime inputs. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { css, Theme } from 'zyzz'

describe('css', () => {
  test('rejects constrained numbers and reserved runtime domains', () => {
    const bound = Theme.define({ color: { ink: 'red' } })

    // @ts-expect-error Bound callbacks reject reserved component fields too.
    bound.css((v: { ref: number }) => ({ opacity: v.ref }))
    // @ts-expect-error Bound callbacks reject unconstrained integer slots too.
    bound.css((v: { level: number }) => ({ zIndex: v.level }))
    // @ts-expect-error Arbitrary numbers cannot satisfy integer properties.
    css((v: { level: number }) => ({ zIndex: v.level }))
    // @ts-expect-error Component refs are not styling values.
    css((v: { ref: number }) => ({ opacity: v.ref }))
    // @ts-expect-error Importance belongs to declarations, not runtime values.
    css((v: { width: `${number}%!` }) => ({ width: v.width }))
  })
  test('checks static callback literals', () => {
    // @ts-expect-error Negative padding remains invalid in callbacks.
    css((v: { alpha: number }) => ({ opacity: v.alpha, padding: '-1px' }))

    const theme = Theme.define({ color: { ink: 'red' } })

    // @ts-expect-error Bound callbacks apply the same literal checks.
    theme.css((v: { alpha: number }) => ({ opacity: v.alpha, padding: '-1px' }))
  })
  test('retains required input domains and styling overrides', () => {
    const bar = css((values: { amount: `${number}%`; alpha: number }) => ({
      width: values.amount,
      opacity: values.alpha,
      display: 'block',
    }))

    expectTypeOf(bar({ amount: '50%', alpha: 0.5 })).toEqualTypeOf<
      css.Props<'react', {}>
    >()

    bar({
      amount: '50%',
      alpha: 0.5,
      className: 'external',
      style: { color: 'red' },
    })
    // @ts-expect-error Missing required values are rejected.
    bar({ amount: '50%' })
    // @ts-expect-error Runtime values retain their literal domain.
    bar({ amount: '50px', alpha: 1 })
    // @ts-expect-error Unrelated component props are not forwarded.
    bar({ amount: '50%', alpha: 1, id: 'bad' })

    const theme = Theme.define({ color: { brand: 'red' } })
    const themed = theme.css((values: { alpha: number }) => ({
      color: 'brand',
      opacity: values.alpha,
    }))

    themed({ alpha: 0.5 })
    // @ts-expect-error Dynamic bound values remain required.
    themed({})
    // @ts-expect-error Bound declarations keep property domains.
    theme.css((values: { width: number }) => ({ width: values.width }))
    // @ts-expect-error Dynamic CSS properties remain typed.
    css((values: { width: number }) => ({ width: values.width }))
  })
})
