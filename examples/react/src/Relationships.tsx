/** Selects related elements using ordinary CSS and style identities. @module */
/* oxlint-disable typescript/restrict-template-expressions -- Selector references are resolved at compile time. */
import { useState } from 'react'
import { css } from './zyzz.config.js'

namespace styles {
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

  export const group = css()

  export const item = css({
    border: '1px solid',
    borderColor: 'line',
    borderRadius: '0.5rem',
    marginTop: 'sm',
    padding: 'sm',
    selectors: {
      [`${group} > &:nth-child(even)`]: { backgroundColor: 'backdrop' },
      [`${group}:hover &`]: { borderColor: 'accent' },
      [`${group}[data-active="true"] > &`]: { color: 'accent' },
    },
  })

  export const sibling = css({
    selectors: { [`${group} + &`]: { fontWeight: 600 } },
  })

  export const parent = css({
    selectors: { '&:has(input:checked)': { color: 'accent' } },
  })
}

/** Keeps application state in data attributes and native controls. */
export function Relationships() {
  const [active, setActive] = useState(false)

  return (
    <section {...styles.card()}>
      <h2>Relationships</h2>
      <label {...styles.parent()}>
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />{' '}
        Highlight children
      </label>
      <div
        {...styles.group()}
        data-active={active}
        data-testid="relationship-group"
      >
        {[1, 2, 3].map((item) => (
          <div key={item} {...styles.item()}>
            Item {item}
          </div>
        ))}
      </div>
      <p {...styles.sibling()}>A sibling selected by the empty group style.</p>
      <p {...styles.muted()}>
        Hover the group. The even child, checked parent, active ancestor, and
        adjacent sibling each use a string inside selectors.
      </p>
    </section>
  )
}
