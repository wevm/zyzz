/**
 * Provides implicit grid tracks and independently authored placement controls.
 * @module
 */
export const controls = {
  cell: 'grid-column-start:2!important;grid-column-end:span 2;grid-row-start:1;grid-row-end:2',
  grid: 'display:grid;width:300px;grid-auto-columns:1fr;grid-auto-rows:40px;grid-auto-flow:column;grid-template-columns:none;grid-template-rows:40px;column-gap:0px',
} as const

export const source = `import { style } from 'zyzz';
export const grid=style({display:'grid',width:'300px',gridAutoColumns:'1fr',gridAutoRows:'40px',gridAutoFlow:'column',gridTemplateColumns:'none',gridTemplateRows:'40px',columnGap:0})();
export const cell=style({gridColumnStart:[1,'2 !important'],gridColumnEnd:'span 2',gridRowStart:1,gridRowEnd:2})();`
