/** Binds live values to static rules and shared registered variables. @module */
import { useState } from 'react'
import { Vars } from 'zyzz'
import { styles as shared } from './Styles.js'
import { css } from './zyzz.config.js'

const vars = Vars.define({
  amount: { inherits: true, initialValue: 0.5, type: 'number' },
})

namespace styles {
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
    opacity: vars.amount,
    width: '100%',
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
    <section {...shared.card()}>
      <h2>Dynamic values & variables</h2>
      <label {...shared.row()}>
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
      <div style={vars.set({ amount: amount / 100 })}>
        <div {...styles.track()}>
          <div {...styles.inherited()} data-testid="variable-bar" />
        </div>
      </div>
      <p {...shared.muted()}>
        The first bar takes a typed callback value. The second fades using a
        shared variable set on its parent. Both use static CSS.
      </p>
    </section>
  )
}
