/**
 * Provides reading-flow and ordinal overrides for real navigation fixtures.
 * @module
 */
export const source = `import { style } from 'zyzz';
export const visual=style({display:'flex',flexDirection:'row-reverse',readingFlow:['normal','flex-visual!']})();
export const ordered=style({display:'flex',readingFlow:'source-order'})();
export const first=style({readingOrder:[0,'-1!']})();`
