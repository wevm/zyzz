/** Binds live values to static rules and shared registered variables. @module */
import { useState } from 'react'
import { variable } from 'zyzz'
import { css } from './zyzz.config.js'

namespace variables {
  export const amount = variable('number', {
    inherits: true,
    initialValue: 0.5,
  })
}

namespace styles {
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

  export const bar = css((values: { width: `${number}%` }) => ({
    backgroundColor: 'accent',
    borderRadius: '0.5rem',
    height: '0.75rem',
    width: values.width,
  }))

  export const inherited = css({
    backgroundColor: 'muted',
    borderRadius: '0.5rem',
    height: '0.75rem',
    opacity: variables.amount,
    width: '100%',
  })

  export const scope = css({
    variables: { [variables.amount]: 0.5 },
  })

  export const track = css({
    backgroundColor: 'backdrop',
    borderRadius: '0.5rem',
    marginTop: 'md',
    overflow: 'hidden',
  })
}

/** One slider drives a callback binding and a variable inherited by a child. */
export function Dynamic() {
  const [amount, setAmount] = useState(50)

  return (
    <section {...styles.section()}>
      <h2>Dynamic values & variables</h2>
      <label {...styles.row()}>
        Amount
        <input
          aria-label="Amount"
          type="range"
          min="0"
          max="100"
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value))}
        />
        <output>{amount}%</output>
      </label>
      <div {...styles.track()}>
        <div
          {...styles.bar({ width: `${amount}%` })}
          data-testid="dynamic-bar"
        />
      </div>
      <div
        {...styles.scope({ variables: { [variables.amount]: amount / 100 } })}
      >
        <div {...styles.track()}>
          <div {...styles.inherited()} data-testid="variable-bar" />
        </div>
      </div>
      <p {...styles.muted()}>
        The first bar takes a typed callback value. The second fades using a
        shared variable set on its parent. Both use static CSS.
      </p>
    </section>
  )
}
