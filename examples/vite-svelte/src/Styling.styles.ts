/** Demonstrates literal reuse, states, fallbacks, and styling overrides. @module */
import { css, theme } from './zyzz.config.js'

/** Static declarations, ordered fallbacks, importance, and token references. */
export namespace styles {
  export const button = css({
    ':hover': { color: 'accent' },
    '&[aria-pressed="true"]': { fontWeight: 700 },
  })

  export const section = css({
    '@layer components': {
      borderTop: '1px solid',
      borderColor: 'line',
      minWidth: 0,
      paddingTop: 'md',
    },
  })

  export const muted = css({ color: 'subtle', fontSize: '0.875rem' })

  export const row = css({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'sm',
  })

  const shape = { borderRadius: '2px', padding: '0.25rem' } as const

  export const label = css({
    ...shape,
    border: '1px solid',
    borderColor: theme.vars.color.accent,
    color: theme.tokens.color.accent,
    display: ['block', 'inline-flex'],
    fontWeight: '600!',
  })
}
