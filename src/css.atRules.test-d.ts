/** Checks nested at-rule inference through the public css function. @module */
import { describe, test } from 'vite-plus/test'
import { css } from 'zyzz'
describe('css', () => {
  test('accepts nested scope and scroll-state conditions', () => {
    css({
      '@scope (.card) to (.stop)': {
        '@container scroll-state(stuck: top)': { color: 'red' },
      },
    })
    css({ '@media\n(width > 1px)': { color: 'red' } })
  })
})
