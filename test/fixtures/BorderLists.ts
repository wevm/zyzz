/**
 * Supplies border color/style lists, width keywords, and elliptical radii.
 * @module
 */

/** Independent native shorthand controls preserve authored ordering. */
export const control =
  'border-color:red rgb(0 128 0) blue gold;border-style:solid dashed dotted double;border-width:thin medium thick 2px;border-inline-color:purple orange;border-block-style:double solid;border-radius:10px 20px 30px 40px / 20px 30px 40px 50px!important;border-top-left-radius:99px;outline-width:thin'

/** Compiled shorthand declarations exercise logical overrides and importance. */
export const source = `import { css } from 'zyzz';
export const box=css({borderColor:'red rgb(0 128 0) blue gold',borderStyle:'solid dashed dotted double',borderWidth:'thin medium thick 2px',borderInlineColor:'purple orange',borderBlockStyle:'double solid',borderRadius:['1px/2px','10px 20px 30px 40px / 20px 30px 40px 50px!'],borderTopLeftRadius:'99px',outlineWidth:'thin'})();`
