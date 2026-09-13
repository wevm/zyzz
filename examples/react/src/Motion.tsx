/** Uses imported keyframes and a relative asset with reduced-motion support. @module */
import { useState } from 'react'
import { keyframes } from 'zyzz/web'
import { css } from './zyzz.config.js'
import grid from './grid.svg'
import { enter } from './motion.js'

const pulse = keyframes({ from: { opacity: 0.4 }, to: { opacity: 1 } })

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

  export const tile = css({
    animationDuration: '600ms',
    animationName: enter,
    backgroundColor: 'backdrop',
    borderRadius: '0.5rem',
    marginTop: 'md',
    padding: 'card',
    '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
    '@starting-style': { opacity: 0 },
  })

  export const dot = css({
    animationDirection: 'alternate',
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationName: pulse,
    backgroundColor: 'accent',
    borderRadius: '50%',
    height: '1rem',
    width: '1rem',
    '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
  })
}

/** Replays entry motion by remounting only the preview. */
export function Motion() {
  const [count, setCount] = useState(0)

  return (
    <section {...styles.section()}>
      <h2>Motion & assets</h2>
      <button {...styles.button()} onClick={() => setCount(count + 1)}>
        Replay animation
      </button>
      <div
        key={count}
        {...styles.tile({ style: { backgroundImage: `url("${grid}")` } })}
      >
        <div {...styles.dot()} data-testid="motion-dot" />
        <p>Imported keyframes. Local SVG background.</p>
      </div>
      <p {...styles.muted()}>
        Both animations respect the system reduced-motion setting.
      </p>
    </section>
  )
}
