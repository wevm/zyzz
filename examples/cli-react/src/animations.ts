/** Shares an animation reference across source modules. @module */
import { keyframes } from 'zyzz/web'

/** Fades content into place. */
export const enter = keyframes({
  from: { opacity: 0, transform: 'translateY(8px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
})
