/** Provides reusable layout styles and stylesheet defaults. @module */
import { global } from 'zyzz/web'
import { css } from './zyzz.config.js'

global({
  '@layer base': {
    body: { fontFamily: 'system-ui, sans-serif', margin: 0 },
    button: { cursor: 'pointer' },
    'button, input, select': { font: 'inherit' },
    'button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible':
      {
        outline: '2px solid currentColor',
        outlineOffset: '4px',
      },
    h1: { fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.05em' },
    h2: { fontSize: '1.125rem', marginBottom: '1rem' },
    p: { lineHeight: 1.6 },
  },
})

/** Shared definitions can be imported and applied directly. */
export namespace styles {
  export const button = css({
    backgroundColor: 'surface',
    border: '1px solid',
    borderColor: 'line',
    borderRadius: '0.5rem',
    color: 'accent',
    padding: 'sm',
    px: 'md',
    ':hover': { borderColor: 'accent' },
    ':disabled': { cursor: 'not-allowed', opacity: 0.45 },
    '&[aria-pressed="true"]': { backgroundColor: 'accent', color: 'surface' },
  })

  export const card = css({
    '@layer components': {
      backgroundColor: 'surface',
      border: '1px solid',
      borderColor: 'line',
      color: 'text',
      borderRadius: 'card',
      minWidth: 0,
      padding: 'card',
    },
  })

  export const muted = css({ color: 'subtle', fontSize: '0.875rem' })

  export const row = css({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'sm',
  })
}
