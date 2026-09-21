/** @jsxImportSource solid-js */
/** Demonstrates independent viewport, container, support, and scope conditions. @module */
import { createSignal } from 'solid-js'
import { style } from './zyzz.config.js'

namespace styles {
  export const section = style({
    '@layer components': {
      borderTop: '1px solid',
      borderColor: 'line',
      minWidth: '[0]',
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

  export const container = style((values: { width: `${number}%` }) => ({
    containerName: 'preview',
    containerType: 'inline-size',
    maxWidth: '[100%]',
    width: `[${values.width}]`,
  }))

  export const content = style({
    backgroundColor: 'backdrop',
    border: '1px solid',
    borderColor: 'line',
    borderRadius: '[0.5rem]',
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
  const [width, setWidth] = createSignal(100)

  return (
    <section {...styles.section()}>
      <h2>Responsive conditions</h2>
      <label {...styles.row()}>
        Container width
        <input
          aria-label="Container width"
          type="range"
          min="35"
          max="100"
          value={width()}
          onInput={(event) => setWidth(Number(event.currentTarget.value))}
        />
        <output>{width()}%</output>
      </label>
      <div {...styles.container({ width: `${width()}%` })}>
        <div {...styles.content()} data-testid="query-content">
          <strong>Scoped accent</strong>
          <span class="scope-stop">
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
