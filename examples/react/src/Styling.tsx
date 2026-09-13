/** Demonstrates literal reuse, states, fallbacks, and styling overrides. @module */
import { useState } from 'react'
import { styles as shared } from './Styles.js'
import { css, theme } from './zyzz.config.js'

namespace styles {
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
    <section {...shared.card()}>
      <h2>Styles & states</h2>
      <div {...shared.row()}>
        <button
          {...shared.button()}
          aria-pressed={selected}
          onClick={() => setSelected(!selected)}
        >
          Toggle state
        </button>
        <button {...shared.button()} disabled>
          Disabled
        </button>
        <button {...shared.button({ style: { borderRadius: '999px' } })}>
          Inline override
        </button>
        <span {...styles.label({ className: 'example-label' })}>
          Shared declarations
        </span>
      </div>
      <p {...shared.muted()}>
        Hover, focus with Tab, or toggle. Static declarations, ordered
        fallbacks, importance, token references, and overrides live beside the
        component.
      </p>
    </section>
  )
}
