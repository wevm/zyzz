/** Demonstrates literal reuse, states, fallbacks, and styling overrides. @module */
import { useState } from 'react'
import { style, vars } from './zyzz.config'

namespace styles {
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
