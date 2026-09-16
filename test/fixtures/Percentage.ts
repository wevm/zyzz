/**
 * Supplies percentage and clamped alpha declarations for public compiler workflows.
 * @module
 */
import type { Style } from 'zyzz'

/** Percentages retain their authored units, including clamped alpha boundaries. */
export const styles = {
  high: { opacity: '150%', fillOpacity: 2, strokeOpacity: '125%' },
  low: { opacity: -1, floodOpacity: '-25%', stopOpacity: 2 },
  text: {
    fontStretch: '120%',
    fontWidth: '125%',
    textSizeAdjust: '110%',
    zoom: '125%',
  },
} as const satisfies Record<string, Style.LiteralProperties>

/** Source values exercise fallbacks and importance before browser clamping. */
export const source = `import { style } from 'zyzz';
export const high = style({opacity:['50%', '150%!'],fillOpacity:2,strokeOpacity:'125%'})();
export const low = style({opacity:-1,floodOpacity:'-25%',stopOpacity:2})();
export const text = style({fontStretch:'120%',fontWidth:'125%',textSizeAdjust:'110%',zoom:'125%'})();`
