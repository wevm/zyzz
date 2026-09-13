/** Checks nested selector declaration inference and configured tokens. @module */
import { describe, test } from 'vite-plus/test'
import { Config, css, Style } from 'zyzz'

describe('css', () => {
  test('accepts strings and style-reference interpolation', () => {
    const card = css()
    const dynamic = css((values: { opacity: number }) => ({
      opacity: values.opacity,
    }))
    const config = Config.create({ theme: { color: { brand: '#06c' } } })
    const themed = config.css({ color: 'brand' })

    css({
      selectors: {
        '&:hover': { color: 'blue' },
        [`${card} > &`]: { color: 'blue' },
        [`&:has(${dynamic})`]: { opacity: 0.5 },
      },
    })
    config.css({ selectors: { [`${themed} + &`]: { color: 'brand' } } })
    css((values: { opacity: number }) => ({
      selectors: { [`${card}:hover &`]: { opacity: values.opacity } },
    }))

    // @ts-expect-error Nested values retain their CSS contracts.
    css({ selectors: { [`${card} &`]: { display: 'unknown-display' } } })
    // @ts-expect-error Nested properties remain exact.
    css({ selectors: { '&:hover': { colour: 'red' } } })
    // @ts-expect-error Root styles do not have configured tokens.
    css({ selectors: { '&:hover': { color: 'brand' } } })
    // @ts-expect-error Core definitions do not resolve compiler-owned selector groups.
    Style.define({ label: { selectors: { '&:hover': { color: 'red' } } } })
  })
})
