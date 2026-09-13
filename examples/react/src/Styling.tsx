/** Demonstrates literal reuse, states, fallbacks, and styling overrides. @module */
import { useState } from 'react'
import { css, theme } from './zyzz.config.js'

namespace styles {
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

  const shape = { borderRadius: '0.5rem', padding: '1rem' } as const

  export const label = css({
    ...shape,
    border: '1px solid',
    borderColor: theme.vars.color.accent,
    color: theme.tokens.color.accent,
    display: ['block', 'inline-flex'],
    fontWeight: '600!',
  })
}

/** Applies styles without a wrapper, provider, or generated component. */
export function Styling() {
  const [selected, setSelected] = useState(false)

  return (
    <section {...styles.card()}>
      <h2>Styles & states</h2>
      <div {...styles.row()}>
        <button
          {...styles.button()}
          aria-pressed={selected}
          onClick={() => setSelected(!selected)}
        >
          Toggle state
        </button>
        <button {...styles.button()} disabled>
          Disabled
        </button>
        <button {...styles.button({ style: { borderRadius: '999px' } })}>
          Inline override
        </button>
        <span {...styles.label({ className: 'example-label' })}>
          Shared declarations
        </span>
      </div>
      <p {...styles.muted()}>
        Hover, focus with Tab, or toggle. Static declarations, ordered
        fallbacks, importance, token references, and overrides live beside the
        component.
      </p>
    </section>
  )
}
