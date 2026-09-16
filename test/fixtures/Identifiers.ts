/**
 * Supplies named declarations and independent animation/container controls.
 * @module
 */
import type { Style } from 'zyzz'

/** Names retain case and property-specific list forms. */
export const styles = {
  container: {
    containerName: 'Card Secondary',
    containerType: 'inline-size',
    width: '200px',
  },
  motion: {
    animationName: 'Fade',
    animationDuration: '1s',
    animationDelay: '-250ms',
    animationPlayState: 'paused',
    animationTimingFunction: 'linear',
    animationFillMode: 'both',
  },
  names: {
    anchorName: '--Anchor',
    scrollTimelineName: '--Scroll, none',
    viewTimelineName: '--View',
    viewTransitionName: 'Hero',
    transitionProperty: 'opacity, transform',
    willChange: 'opacity, contents',
  },
} as const satisfies Record<string, Style.LiteralProperties>

/** Ordinary CSS owns keyframes and queries; named declarations connect to them. */
export const native =
  '@keyframes Fade{from{opacity:0}to{opacity:1}}@keyframes fade{from{opacity:1}to{opacity:0}}@container Card (min-width:100px){.probe{color:rgb(0 128 0)}}'

/** Source compilation preserves names rather than normalizing their case. */
export const source = `import { style } from 'zyzz';
export const container = style({containerName:'Card Secondary',containerType:'inline-size',width:'200px'})();
export const motion = style({animationName:'Fade',animationDuration:'1s',animationDelay:'-250ms',animationPlayState:'paused',animationTimingFunction:'linear',animationFillMode:'both'})();
export const names = style({anchorName:'--Anchor',scrollTimelineName:'--Scroll, none',viewTimelineName:'--View',viewTransitionName:'Hero',transitionProperty:'opacity, transform',willChange:'opacity, contents'})();`
