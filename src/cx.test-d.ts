/** Checks applied-props-only composition through the public root entrypoint. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { css, cx, Config, variants } from 'zyzz'

describe('cx', () => {
  test('returns one props object and rejects unrelated inputs', () => {
    const a = css({ color: 'red' })
    const b = css({ padding: '8px' })
    expectTypeOf(cx(a(), false, null, undefined, b())).toHaveProperty(
      'className',
    )
    const { css: html } = Config.create({ output: 'html' })
    expectTypeOf(cx(html({ color: 'red' })())).toHaveProperty('class')
    const dynamic = css((values: { padding: `${number}px` }) => ({
      padding: values.padding,
    }))
    const recipe = variants({
      variants: {
        tone: {
          custom: (values: { color: 'red' | 'blue' }) => ({
            color: values.color,
          }),
        },
      },
    })
    cx(
      dynamic({ padding: '12px' }),
      recipe({ tone: { custom: { color: 'red' } } }),
    )
    // @ts-expect-error Bare class strings are not applied props.
    cx('external')
    // @ts-expect-error Definitions must be applied first.
    cx(a)
    // @ts-expect-error Composition does not forward component props.
    cx({ className: 'external', onClick: () => {} })
  })
})
