/**
 * Exercises compatible text and flex groups and timeline scalar lists.
 * @module
 */
import type { Style } from 'zyzz'

/** Authoring fixtures preserve deliberate shorthand/longhand ordering. */
export const styles = {
  flow: {
    display: 'flex',
    flexFlow: 'wrap column',
    flexDirection: 'row',
    textWrap: 'balance wrap',
    textWrapStyle: 'pretty',
  },
  text: {
    textUnderlinePosition: 'right under',
    verticalAlign: '-2px',
    borderImageRepeat: 'round stretch',
    viewTimelineAxis: 'block, x',
    interestDelayStart: '250ms',
  },
} as const satisfies Record<string, Style.LiteralProperties>

/** Independent native controls describe the same final declarations. */
export const controls = {
  flow: 'display:flex;flex-flow:wrap column;flex-direction:row;text-wrap:balance wrap;text-wrap-style:pretty',
  text: 'text-underline-position:right under;vertical-align:-2px;border-image-repeat:round stretch;view-timeline-axis:block,x;interest-delay-start:250ms',
} as const

/** Source compilation exercises lists, grouped keywords, and authored overrides. */
export const source = `import { style } from 'zyzz';
export const flow = style({display:'flex',flexFlow:'wrap column',flexDirection:'row',textWrap:'balance wrap',textWrapStyle:'pretty'})();
export const text = style({textUnderlinePosition:'right under',verticalAlign:'-2px',borderImageRepeat:'round stretch',viewTimelineAxis:'block, x',interestDelayStart:'250ms'})();`
