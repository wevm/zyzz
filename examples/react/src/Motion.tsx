/** Uses imported keyframes and a relative asset with reduced-motion support. @module */
import { useState } from 'react'
import { keyframes } from 'zyzz/web'
import { styles as shared } from './Styles.js'
import { css } from './zyzz.config.js'
import grid from './grid.svg'
import { enter } from './motion.js'

const pulse = keyframes({ from: { opacity: 0.4 }, to: { opacity: 1 } })

namespace styles {
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
    <section {...shared.card()}>
      <h2>Motion & assets</h2>
      <button {...shared.button()} onClick={() => setCount(count + 1)}>
        Replay animation
      </button>
      <div
        key={count}
        {...styles.tile({ style: { backgroundImage: `url("${grid}")` } })}
      >
        <div {...styles.dot()} data-testid="motion-dot" />
        <p>Imported keyframes. Local SVG background.</p>
      </div>
      <p {...shared.muted()}>
        Both animations respect the system reduced-motion setting.
      </p>
    </section>
  )
}
