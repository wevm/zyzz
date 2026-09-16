/**
 * Supplies motion lists and easing curves for compiler and browser comparisons.
 * @module
 */

/** Valid easing samples checked against independent CSS grammar. */
export const easing = [
  'cubic-bezier(0, -1, 1, 2)',
  'cubic-bezier(.25, 1e-1, .75, 1)',
  'steps(4)',
  'steps(+4, jump-none)',
  'steps(1, jump-both)',
  'linear(0, .5 25% 75%, 1)',
  'linear(0% 0, 100% 1)',
  'ease, steps(2, end), linear(0, 1)',
] as const

/** Invalid numeric constraints, delimiters, and unsupported function arguments. */
export const invalid = [
  'cubic-bezier(-.1, 0, 1, 1)',
  'cubic-bezier(0, 0, 1.1, 1)',
  'cubic-bezier(0, 0, 1)',
  'cubic-bezier(0, NaN, 1, 1)',
  'steps(0)',
  'steps(1, jump-none)',
  'steps(2.5, end)',
  'steps(2, nowhere)',
  'linear(0)',
  'linear(0 0% 100%)',
  'linear(0, 1 50% 60% 70%)',
  'linear(0, 50% 1 100%)',
  'ease,',
  ',ease',
  'ease,,linear',
  'ease, inherit',
  'steps(2)), ease',
  'steps(2), ease; opacity:0',
] as const

/** Compiled motion lists retain importance and fallback order. */
export const source = `import { style } from 'zyzz';
export const motion=style({animationDelay:'-250ms, 0s',animationDirection:'normal, reverse',animationDuration:'1s, 2s',animationFillMode:'both, forwards',animationIterationCount:'2.5, infinite',animationPlayState:'paused, paused',animationTimingFunction:'steps(4, end), linear(0, 1)',transitionBehavior:'normal, allow-discrete',transitionDelay:'0s, -.5s',transitionDuration:['1s, 2s','250ms, 500ms!'],transitionTimingFunction:'cubic-bezier(0, -1, 1, 2), steps(2, jump-none)'})();`

/** Native declarations independently spell the expected cascade. */
export const control =
  'animation-delay:-250ms,0s;animation-direction:normal,reverse;animation-duration:1s,2s;animation-fill-mode:both,forwards;animation-iteration-count:2.5,infinite;animation-play-state:paused,paused;animation-timing-function:steps(4,end),linear(0,1);transition-behavior:normal,allow-discrete;transition-delay:0s,-.5s;transition-duration:250ms,500ms!important;transition-timing-function:cubic-bezier(0,-1,1,2),steps(2,jump-none)'
