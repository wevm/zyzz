/**
 * Supplies compound scalar declarations and independent native painting controls.
 * @module
 */
import type { Style } from 'zyzz'

/** Numeric factors, dimensions, colors, and markers retain distinct domains. */
export const styles = {
  border: {
    borderImageSlice: '25% fill',
    borderImageWidth: '1 2 3 4',
    borderImageOutset: '2px 4px 6px 8px',
  },
  mask: {
    maskBorderSlice: '10 20 30 40 fill',
    maskBorderWidth: '1 auto 20% 3px',
    maskBorderOutset: '1 2px',
  },
  text: {
    hyphenateLimitChars: 'auto 3 2',
    MsHyphenateLimitChars: '5 3 2',
    scrollbarColor: 'red blue',
    MozBorderTopColors: 'red blue green yellow black white',
  },
  timing: {
    interestDelay: '100ms 200ms',
    viewTimelineInset: 'auto 10%, -20px 30%',
  },
} as const satisfies Record<string, Style.LiteralProperties>

/** Independent declaration text supplies a native image-border control. */
export const control =
  'border-image-slice:25% fill;border-image-width:1 2 3 4;border-image-outset:2px 4px 6px 8px'

/** Source exercises scalar tuple emission and delay-shorthand reset ordering. */
export const source = `import { css } from 'zyzz';
export const border = css({borderImageSlice:'25% fill',borderImageWidth:'1 2 3 4',borderImageOutset:'2px 4px 6px 8px'})();
export const text = css({scrollbarColor:'red blue',hyphenateLimitChars:'auto 3 2'})();
export const first = css({interestDelay:'100ms 200ms'})();
export const second = css({interestDelayEnd:'300ms'})();
export const third = css({interestDelay:'100ms 200ms',opacity:.5})();`
