/** Demonstrates literal reuse, states, fallbacks, and styling overrides. @module */
import { style, vars } from './zyzz.config.js'

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
      minWidth: '0 !custom',
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

  const shape = {
    borderRadius: '2px !custom',
    padding: '0.25rem !custom',
  } as const

  export const label = style({
    ...shape,
    border: '1px solid',
    borderColor: vars.color.accent,
    color: vars.color.accent,
    display: ['block', 'inline-flex'],
    fontWeight: '600 !important',
  })
}
