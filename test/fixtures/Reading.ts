/**
 * Provides reading-flow and ordinal overrides for real navigation fixtures.
 * @module
 */
export const source = `import { css } from 'zyzz';
export const visual=css({display:'flex',flexDirection:'row-reverse',readingFlow:['normal','flex-visual!']})();
export const ordered=css({display:'flex',readingFlow:'source-order'})();
export const first=css({readingOrder:[0,'-1!']})();`
