/**
 * Supplies deferred custom-property substitutions and independent native controls.
 * @module
 */

/** Compiled references include nested and empty fallbacks, lists, and arithmetic. */
export const source = `import { style } from 'zyzz';
export const box=style({color:['red','var(--ink, var(--fallback, blue)) !important'],width:'calc(var(--width, 100px) - var(--gap, 10px))',padding:'var(--pad, 2px 4px)',opacity:'var(--alpha, .5)',display:'var(--display, block)'})();
export const empty=style({padding:['8px','var(--absent,)']})();`

/** Native declarations independently reproduce substitution and cascade semantics. */
export const control =
  'color:var(--ink,var(--fallback,blue))!important;width:calc(var(--width,100px) - var(--gap,10px));padding:var(--pad,2px 4px);opacity:var(--alpha,.5);display:var(--display,block)'
