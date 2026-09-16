/**
 * Supplies corner curvature, cascade reset, and layout-alias browser fixtures.
 * @module
 */
import type { Style } from 'zyzz'

/** Finite and functional corner values preserve ordered longhand overrides. */
export const styles = {
  bevel: {
    width: '100px',
    height: '100px',
    borderRadius: '50px',
    cornerShape: 'bevel',
    backgroundColor: 'blue',
  },
  mixed: {
    cornerShape: 'superellipse(2) notch scoop square',
    cornerTopLeftShape: 'round',
    cornerStartEndShape: 'superellipse(-1)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '20px 20px',
    gridGap: '10px 20px',
    columnGap: '12px',
    justifyItems: 'safe end',
    justifySelf: 'safe start',
  },
} as const satisfies Record<string, Style.LiteralProperties>

/** Browser source includes A/B/A declarations around an all reset. */
export const source = `import { style } from 'zyzz';
export const bevel = style({width:'100px',height:'100px',borderRadius:'50px',cornerShape:'bevel',backgroundColor:'blue'})();
export const mixed = style({cornerShape:'superellipse(2) notch scoop square',cornerTopLeftShape:'round',cornerStartEndShape:'superellipse(-1)'})();
export const grid = style({display:'grid',gridTemplateColumns:'20px 20px',gridGap:'10px 20px',columnGap:'12px',justifyItems:'safe end',justifySelf:'safe start'})();
export const first = style({color:'red'})();
export const reset = style({all:'initial'})();
export const last = style({color:'red',fontWeight:700})();`
