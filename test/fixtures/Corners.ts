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
export const source = `import { css } from 'zyzz';
export const bevel = css({width:'100px',height:'100px',borderRadius:'50px',cornerShape:'bevel',backgroundColor:'blue'})();
export const mixed = css({cornerShape:'superellipse(2) notch scoop square',cornerTopLeftShape:'round',cornerStartEndShape:'superellipse(-1)'})();
export const grid = css({display:'grid',gridTemplateColumns:'20px 20px',gridGap:'10px 20px',columnGap:'12px',justifyItems:'safe end',justifySelf:'safe start'})();
export const first = css({color:'red'})();
export const reset = css({all:'initial'})();
export const last = css({color:'red',fontWeight:700})();`
