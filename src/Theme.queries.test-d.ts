/** Checks that query metadata stays out of declaration variables and typography domains stay distinct. @module */
import { describe, test } from 'vite-plus/test'
import { Theme } from 'zyzz'
import { css } from './themes/default.js'

describe('define', () => {
  test('retains scalar domains', () => {
    const theme = Theme.define({
      breakpoints: { tablet: '48rem' },
      containers: { card: '24rem' },
      fontSize: { body: '1rem' },
      fontWeight: { medium: 500 },
    })
    theme.css({ fontSize: 'body', fontWeight: 'medium' })
    css({ fontFamily: 'sans', fontSize: 'base', color: 'blue.500', padding: 4 })
    // @ts-expect-error Thresholds are nonnegative.
    Theme.define({ breakpoints: { bad: '-1px' } })
    // @ts-expect-error Font weights cannot exceed 1000.
    Theme.define({ fontWeight: { bad: 2000 } })
    // @ts-expect-error Font sizes cannot be negative.
    Theme.define({ fontSize: { bad: '-1px' } })
    // @ts-expect-error Line heights cannot be negative.
    Theme.define({ lineHeight: { bad: -1 } })
    // @ts-expect-error CSS-wide keywords cannot be custom-property token leaves.
    Theme.define({ fontSize: { bad: 'initial' } })
    // @ts-expect-error Query metadata is not a declaration variable.
    void theme.vars.breakpoints.tablet
    // @ts-expect-error Query metadata is not a portable declaration reference.
    void theme.tokens.containers.card
    // @ts-expect-error Query lengths cannot be percentages.
    Theme.define({ breakpoints: { tablet: '50%' } })
    // @ts-expect-error Typography references retain their scalar property domain.
    theme.css({ color: theme.tokens.fontSize.body })
  })
})
