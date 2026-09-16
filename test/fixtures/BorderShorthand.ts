/**
 * Supplies combined line declarations with physical and logical overrides.
 * @module
 */
import type { Style } from 'zyzz'

/** Deliberate shorthand order exercises mixed border axes and importance. */
export const styles = {
  box: {
    border: '2px solid red',
    borderInlineStart: 'blue dashed 4px',
    borderTop: '3px dotted green',
    outline: '1px solid black',
    columnRule: '2px dashed blue',
  },
} as const satisfies Record<string, Style.LiteralProperties>

/** Native control remains independent of the compiler's property expansion. */
export const control =
  'border:2px solid red;border-inline-start:blue dashed 4px;border-top:3px dotted green;outline:1px solid black;column-rule:2px dashed blue'

/** Source uses shorthand values without pre-expanding their constituent properties. */
export const source = `import { style } from 'zyzz';
export const box = style({border:'2px solid red',borderInlineStart:'blue dashed 4px',borderTop:'3px dotted green',outline:'1px solid black',columnRule:'2px dashed blue'})();`
