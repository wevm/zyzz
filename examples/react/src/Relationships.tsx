/** Selects related elements using ordinary CSS and style identities. @module */
import { useState } from 'react'
import { where } from 'zyzz'
import { styles as shared } from './Styles.js'
import { css } from './zyzz.config.js'

namespace styles {
  export const group = css()

  export const item = css({
    border: '1px solid',
    borderColor: 'line',
    borderRadius: '0.5rem',
    marginTop: 'sm',
    padding: 'sm',
    [where`${group} > &:nth-child(even)`]: { backgroundColor: 'backdrop' },
    [where`${group}:hover &`]: { borderColor: 'accent' },
    [where`${group}[data-active="true"] > &`]: { color: 'accent' },
  })

  export const sibling = css({ [where`${group} + &`]: { fontWeight: 600 } })

  export const parent = css({
    [where`&:has(input:checked)`]: { color: 'accent' },
  })
}

/** Keeps application state in data attributes and native controls. */
export function Relationships() {
  const [active, setActive] = useState(false)

  return (
    <section {...shared.card()}>
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
      <p {...shared.muted()}>
        Hover the group. The even child, checked parent, active ancestor, and
        adjacent sibling each use a small where template.
      </p>
    </section>
  )
}
