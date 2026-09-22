/** Uses local and imported keyframes with reduced-motion support. @module */
import { useState } from 'react'
import { keyframes } from 'zyzz/web'
import { enter } from './animations.js'
import { style } from './zyzz.config.js'

const pulse = keyframes({ from: { opacity: 0.4 }, to: { opacity: 1 } })

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

  export const tile = style({
    animationDuration: '600ms',
    animationName: enter,
    backgroundColor: 'backdrop',
    borderRadius: '0.5rem !custom',
    marginTop: 'md',
    padding: 'card',
    '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
    '@starting-style': { opacity: 0 },
  })

  export const dot = style({
    animationDirection: 'alternate',
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationName: pulse,
    backgroundColor: 'accent',
    borderRadius: '50% !custom',
    height: '1rem !custom',
    width: '1rem !custom',
    '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
  })
}

/** Replays entry motion by remounting only the preview. */
export function Motion() {
  const [count, setCount] = useState(0)

  return (
    <section {...styles.section()}>
      <h2>Motion</h2>
      <button {...styles.button()} onClick={() => setCount(count + 1)}>
        Replay animation
      </button>
      <div key={count} {...styles.tile()}>
        <div {...styles.dot()} data-testid="motion-dot" />
        <p>Imported keyframes land in the shared stylesheet.</p>
      </div>
      <p {...styles.muted()}>
        Both animations respect the system reduced-motion setting.
      </p>
    </section>
  )
}
