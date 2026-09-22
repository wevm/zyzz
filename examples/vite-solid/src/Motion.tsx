/** @jsxImportSource solid-js */
/** Uses imported keyframes and a relative asset with reduced-motion support. @module */
import { createSignal, Show } from 'solid-js'
import { keyframes } from 'zyzz/web'
import grid from './grid.svg'
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

/** Replays entry motion by recreating only the preview through a keyed Show. */
export function Motion() {
  const [replay, setReplay] = createSignal(1)

  return (
    <section {...styles.section()}>
      <h2>Motion & assets</h2>
      <button {...styles.button()} onClick={() => setReplay(replay() + 1)}>
        Replay animation
      </button>
      <Show when={replay()} keyed>
        <div {...styles.tile({ style: { backgroundImage: `url("${grid}")` } })}>
          <div {...styles.dot()} data-testid="motion-dot" />
          <p>Imported keyframes. Local SVG background.</p>
        </div>
      </Show>
      <p {...styles.muted()}>
        Both animations respect the system reduced-motion setting.
      </p>
    </section>
  )
}
