/**
 * Provides physical shorthand lists and logical pairs with native CSS controls.
 * @module
 */
export const control =
  'border-style:solid;border-width:1px 2px 3px 4px;inset:1px 2px 3px 4px;margin:4px 8px 12px 16px;margin-inline:20px 30px;padding:1px 2px;padding:4px 8px 12px 16px!important;padding-left:99px;scroll-margin:1px 2px 3px 4px;scroll-padding-inline:10% auto'

export const source = `import { style } from 'zyzz';
export const box=style({borderStyle:'solid',borderWidth:'1px 2px 3px 4px',inset:'1px 2px 3px 4px',margin:'4px 8px 12px 16px',marginInline:'20px 30px',padding:['1px 2px','4px 8px 12px 16px!'],paddingLeft:'99px',scrollMargin:'1px 2px 3px 4px',scrollPaddingInline:'10% auto'})();`
