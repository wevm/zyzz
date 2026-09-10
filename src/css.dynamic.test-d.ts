/** Checks dynamic callable inference and exact required runtime inputs. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { css, Theme } from 'zyzz'

describe('css', () => {
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
    expectTypeOf(bar({ amount: '50%', alpha: 0.5 })).toEqualTypeOf<css.Props>()
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
