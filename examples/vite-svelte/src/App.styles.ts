/** Styles and global rules for the playground shell. @module */
import { global } from 'zyzz/web'
import { style } from './zyzz.config.js'

global({
  '@layer base': {
    body: { fontFamily: 'system-ui, sans-serif', margin: 0 },
    // The default scheme follows the system; a selected scheme class on <html> overrides it.
    html: { colorScheme: 'light dark' },
    button: { cursor: 'pointer' },
    'button, input, select': { font: 'inherit' },
    'button:focus-visible, input:focus-visible, select:focus-visible': {
      outline: '2px solid currentColor',
      outlineOffset: '4px',
    },
    h1: { fontSize: '1.5rem' },
    h2: { fontSize: '1.125rem', marginBottom: '1rem' },
    p: { lineHeight: 1.5 },
  },
})

/** Svelte components spread these applied styles as native attributes. */
export namespace styles {
  export const button = style({
    ':hover': { color: 'accent' },
    '&[aria-pressed="true"]': { fontWeight: 700 },
  })

  export const section = style({
    '@layer components': {
      borderTop: '1px solid',
      borderColor: 'line',
      minWidth: '[0]',
      paddingTop: 'md',
    },
  })

  export const nested = style({
    backgroundColor: 'surface',
    border: '1px solid',
    borderColor: 'line',
    color: 'text',
    marginTop: 'sm',
    padding: 'md',
  })

  export const sample = style({ color: 'accent' })

  export const muted = style({ color: 'subtle', fontSize: '0.875rem' })

  export const row = style({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'sm',
  })

  export const page = style({
    backgroundColor: 'surface',
    color: 'text',
    minHeight: '[100vh]',
    padding: 'md',
  })

  export const content = style({ marginInline: '[auto]', maxWidth: '[48rem]' })

  export const grid = style({
    display: 'grid',
    gap: 'md',
    marginTop: 'section',
  })
}
