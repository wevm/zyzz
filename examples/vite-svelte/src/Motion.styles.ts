/** Uses imported keyframes with reduced-motion support. @module */
import { keyframes } from 'zyzz/web'
import { enter } from './motion.js'
import { style } from './zyzz.config.js'

const pulse = keyframes({ from: { opacity: 0.4 }, to: { opacity: 1 } })

/** Entry and pulse animations that pause under reduced motion. */
export namespace styles {
  export const button = style({
    ':hover': { color: 'accent' },
    '&[aria-pressed="true"]': { fontWeight: 700 },
  })

  export const section = style({
    '@layer components': {
      borderTop: '1px solid',
      borderColor: 'line',
      minWidth: '[0]',
      paddingTop: 'md',
    },
  })

  export const muted = style({ color: 'subtle', fontSize: '0.875rem' })

  export const tile = style({
    animationDuration: '600ms',
    animationName: enter,
    backgroundColor: 'backdrop',
    borderRadius: '[0.5rem]',
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
    borderRadius: '[50%]',
    height: '[1rem]',
    width: '[1rem]',
    '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
  })
}
