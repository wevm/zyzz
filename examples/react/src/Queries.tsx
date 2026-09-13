/** Demonstrates independent viewport, container, support, and scope conditions. @module */
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

  export const row = css({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'sm',
  })

  export const container = css((values: { width: `${number}%` }) => ({
    containerName: 'preview',
    containerType: 'inline-size',
    maxWidth: '100%',
    width: values.width,
  }))

  export const content = css({
    backgroundColor: 'backdrop',
    border: '1px solid',
    borderColor: 'line',
    borderRadius: '0.5rem',
    display: 'grid',
    gap: 'sm',
    marginTop: 'md',
    padding: 'sm',
    '@container preview >=card': {
      gridTemplateColumns: '1fr 1fr',
      padding: 'md',
    },
    '@media wide': { borderWidth: '2px' },
    '@supports (text-wrap: balance)': { textWrap: 'balance' },
    '@scope (&) to (.scope-stop)': { '& strong': { color: 'accent' } },
  })
}

/** Resizes a query container without changing the viewport. */
export function Queries() {
  const [width, setWidth] = useState(100)

  return (
    <section {...styles.card()}>
      <h2>Responsive conditions</h2>
      <label {...styles.row()}>
        Container width
        <input
          aria-label="Container width"
          type="range"
          min="35"
          max="100"
          value={width}
          onChange={(event) => setWidth(Number(event.target.value))}
        />
        <output>{width}%</output>
      </label>
      <div {...styles.container({ width: `${width}%` })}>
        <div {...styles.content()} data-testid="query-content">
          <strong>Scoped accent</strong>
          <span className="scope-stop">
            <strong>Outside scope</strong>
          </span>
        </div>
      </div>
      <p {...styles.muted()}>
        Above 20rem, the container has two columns. A wide viewport thickens its
        border. Supports and scope rules stay in CSS.
      </p>
    </section>
  )
}
