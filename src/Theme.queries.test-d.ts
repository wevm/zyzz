/** Checks that query metadata stays out of declaration variables and typography domains stay distinct. @module */
import { describe, test } from 'vite-plus/test'
import { Config, Theme } from 'zyzz'
import { css } from './themes/default.js'

describe('define', () => {
  test('checks literal container identities', () => {
    Theme.define({ containerNames: ['--sidebar', '-sidebar', '侧栏'] })
    // @ts-expect-error Literal identities must be unique.
    Theme.define({ containerNames: ['sidebar', 'sidebar'] })
    // @ts-expect-error Container query operators cannot name containers.
    Theme.define({ containerNames: ['and'] })
  })
  test('rejects reserved container identities', () => {
    // @ts-expect-error Container identities exclude reserved keywords.
    Theme.define({ containerNames: ['none'] })
    // @ts-expect-error Container keywords are case insensitive.
    Theme.define({ containerNames: ['INITIAL'] })
  })

  test('rejects CSS-wide typography leaves', () => {
    // @ts-expect-error Typography leaves cannot override CSS-wide keywords.
    Theme.define({ fontFamily: { body: 'inherit' } })
    // @ts-expect-error CSS-wide keywords are case insensitive.
    Theme.define({ fontFamily: { body: 'INITIAL' } })
  })

  test('retains scalar domains', () => {
    const theme = Theme.define({
      breakpoints: { tablet: '48rem' },
      containers: { card: '24rem' },
      fontSize: { body: '1rem' },
      fontWeight: { medium: 500 },
    })
    theme.css({ fontSize: 'body', fontWeight: 'medium' })
    css({ fontFamily: 'sans', fontSize: 'base', color: 'blue.500', padding: 4 })
    const odd = Theme.define({ spacing: { '01': '1px', '1e3': '2px' } })
    odd.css({ padding: '01' })
    // @ts-expect-error Noncanonical numeric keys cannot widen shorthand numbers.
    odd.css({ padding: 999 })
    Config.create({
      defaultTheme: 'base',
      themes: {
        base: { containerNames: ['sidebar'] },
        // @ts-expect-error Named themes must expose the same container identities.
        other: { containerNames: ['content'] },
      },
    })
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
