/** Demonstrates literal reuse, states, fallbacks, and styling overrides. @module */
import { useState } from 'react'
import { css, theme } from './zyzz.config.js'

namespace styles {
  export const button = css({
    ':hover': { color: 'accent' },
    '&[aria-pressed="true"]': { fontWeight: '700' },
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

/** Applies styles without a wrapper, provider, or generated component. */
export function Styling() {
  const [selected, setSelected] = useState(false)

  return (
    <section {...styles.section()}>
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
        <button {...styles.button({ style: { borderRadius: '0px' } })}>
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
