/** Demonstrates literal reuse, states, fallbacks, and styling overrides. @module */
import { style, theme } from './zyzz.config.js'

/** Static declarations, ordered fallbacks, importance, and token references. */
export namespace styles {
  export const button = style({
    ':hover': { color: 'accent' },
    '&[aria-pressed="true"]': { fontWeight: 700 },
  })

  export const section = style({
    '@layer components': {
      borderTop: '1px solid',
      borderColor: 'line',
      minWidth: 0,
      paddingTop: 'md',
    },
  })

  export const muted = style({ color: 'subtle', fontSize: '0.875rem' })

  export const row = style({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'sm',
  })

  const shape = { borderRadius: '2px', padding: '0.25rem' } as const

  export const label = style({
    ...shape,
    border: '1px solid',
    borderColor: theme.vars.color.accent,
    color: theme.tokens.color.accent,
    display: ['block', 'inline-flex'],
    fontWeight: '600 !important',
  })
}
