/**
 * Supplies SVG geometry and text declarations for compiler and native comparisons.
 * @module
 */
import type { Style } from 'zyzz'

/** Typed geometry includes signed positions and nonnegative radii. */
export const styles = {
  circle: { cx: '40px', cy: '30px', r: '20px' },
  rectangle: { x: '-2px', y: '5px', rx: '8px', ry: '4px' },
  text: {
    baselineShift: '2px',
    textAnchor: 'middle',
    fontVariantEmoji: 'text',
    whiteSpaceCollapse: 'preserve',
    textWrapMode: 'nowrap',
    wordWrap: 'break-word',
    scrollbarGutter: 'stable both-edges',
  },
} as const satisfies Record<string, Style.LiteralProperties>

/** Independent native declarations exercise actual SVG geometry and text output. */
export const controls = {
  circle: 'cx:40px;cy:30px;r:20px',
  rectangle: 'x:-2px;y:5px;rx:8px;ry:4px',
  text: 'baseline-shift:2px;text-anchor:middle;font-variant-emoji:text;white-space-collapse:preserve;text-wrap-mode:nowrap;word-wrap:break-word;scrollbar-gutter:stable both-edges',
} as const

/** Public compiler input preserves geometry and text spelling. */
export const source = `import { css } from 'zyzz';
export const circle = css({cx:'40px',cy:'30px',r:'20px'})();
export const rectangle = css({x:'-2px',y:'5px',rx:'8px',ry:'4px'})();
export const text = css({baselineShift:'2px',textAnchor:'middle',fontVariantEmoji:'text',whiteSpaceCollapse:'preserve',textWrapMode:'nowrap',wordWrap:'break-word',scrollbarGutter:'stable both-edges'})();`
