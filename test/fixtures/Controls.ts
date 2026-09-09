/**
 * Provides list markers and input controls with independent CSS references.
 * @module
 */
export const controls = {
  input:
    'appearance:none;overflow-anchor:none;overscroll-behavior-block:contain;overscroll-behavior-inline:none;scrollbar-width:thin;tab-size:8;text-size-adjust:none;touch-action:pinch-zoom pan-left pan-up',
  list: 'line-break:strict;list-style-position:inside;list-style-type:upper-roman;text-spacing-trim:space-all;unicode-bidi:isolate',
} as const

export const source = `import { css } from 'zyzz';
export const list=css({lineBreak:'strict',listStylePosition:'inside',listStyleType:'upper-roman',textSpacingTrim:'space-all',unicodeBidi:'isolate'})();
export const input=css({appearance:'none',overflowAnchor:'none',overscrollBehaviorBlock:'contain',overscrollBehaviorInline:'none',scrollbarWidth:'thin',tabSize:[4,'8!'],textSizeAdjust:'none',touchAction:'pinch-zoom pan-left pan-up'})();`
