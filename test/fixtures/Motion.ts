/**
 * Provides paused motion fixtures with independent timing controls.
 * @module
 */
export const controls = {
  motion:
    'animation-delay:-500ms;animation-duration:2s;animation-direction:alternate;animation-fill-mode:both;animation-iteration-count:2.5;animation-play-state:paused;animation-timing-function:linear',
  transition:
    'transition-delay:-.1s;transition-duration:250ms;transition-timing-function:ease-in-out;transition-behavior:allow-discrete',
} as const

export const source = `import { style } from 'zyzz';
export const motion=style({animationDelay:'-500ms',animationDuration:['1s','2s!'],animationDirection:'alternate',animationFillMode:'both',animationIterationCount:2.5,animationPlayState:'paused',animationTimingFunction:'linear'})();
export const transition=style({transitionDelay:'-.1s',transitionDuration:'250ms',transitionTimingFunction:'ease-in-out',transitionBehavior:'allow-discrete'})();`
