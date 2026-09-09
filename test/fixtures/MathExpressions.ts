/**
 * Provides nested dimensional arithmetic and independent browser controls.
 * @module
 */

/** Compiled math values exercise layout, range clamping, time, and integer semantics. */
export const source = `import { css } from 'zyzz';
export const box=css({width:'clamp(20px, calc(50% - 10px), 200px)',height:'max(20px, min(80px, 10vh))',padding:'calc(2px * 3) min(20px, 5%)',borderRadius:'calc(20px / 2) / max(10px, 5%)',opacity:'calc(1 / 2)',order:'calc(1.5)',transitionDuration:'calc(1s + 250ms), min(2s, 500ms)'})();
export const grid=css({display:'grid',gridTemplateColumns:'minmax(calc(10px + 2px), 1fr) clamp(20px, 10%, 50px)'})();`

/** Native declarations are authored independently of the compiled output. */
export const control =
  'width:clamp(20px,calc(50% - 10px),200px);height:max(20px,min(80px,10vh));padding:calc(2px * 3) min(20px,5%);border-radius:calc(20px / 2) / max(10px,5%);opacity:calc(1 / 2);order:calc(1.5);transition-duration:calc(1s + 250ms),min(2s,500ms)'
