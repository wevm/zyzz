/**
 * Supplies named timeline ranges and independent scroll-animation controls.
 * @module
 */
import type { Style } from 'zyzz'

/** Range names and signed offsets remain distinct from standalone defaults. */
export const styles = {
  animationRangeEnd: 'exit 80%',
  animationRangeStart: 'entry 20%',
  timelineTriggerActivationRangeEnd: 'cover 90%, exit',
  timelineTriggerActivationRangeStart: 'contain -10px',
  timelineTriggerActiveRangeEnd: 'auto, exit-crossing 100%',
  timelineTriggerActiveRangeStart: 'normal, entry-crossing calc(10% + 2px)',
} as const satisfies Style.LiteralProperties

/** Authored ranges operate on a native view timeline. */
export const source = `import { css } from 'zyzz';
export const range = css({animationRangeStart:'entry 20%',animationRangeEnd:'exit 80%'})();`
