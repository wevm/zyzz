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
  intrinsic: {
    containIntrinsicBlockSize: 'auto 20px',
    containIntrinsicHeight: 'none',
    containIntrinsicInlineSize: 'auto none',
    containIntrinsicSize: 'auto 80px auto 40px',
    containIntrinsicWidth: '40px',
    fontSizeAdjust: 'cap-height .7',
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
export const source = `import { style } from 'zyzz';
export const border = style({borderImageSlice:'25% fill',borderImageWidth:'1 2 3 4',borderImageOutset:'2px 4px 6px 8px'})();
export const text = style({scrollbarColor:'red blue',hyphenateLimitChars:'auto 3 2'})();
export const intrinsic = style({contain:'size',containIntrinsicSize:'auto 80px auto 40px',display:'inline-block'})();
export const sizingFirst = style({containIntrinsicSize:'80px 40px'})();
export const sizingSecond = style({containIntrinsicWidth:'120px'})();
export const sizingThird = style({containIntrinsicSize:'80px 40px',opacity:.5})();
export const first = style({interestDelay:'100ms 200ms'})();
export const second = style({interestDelayEnd:'300ms'})();
export const third = style({interestDelay:'100ms 200ms',opacity:.5})();`
