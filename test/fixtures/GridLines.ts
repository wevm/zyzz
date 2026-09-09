/**
 * Supplies grid placement declarations with independent native layout controls.
 * @module
 */
import type { Style } from 'zyzz'

/** Named, numbered, and spanning line combinations retain authored order. */
export const styles = {
  gridArea: '1 / 2 / 3 / 4',
  gridColumn: 'start / end',
  gridColumnEnd: 'span 2 content',
  gridColumnStart: 'content 2',
  gridRow: '1 / span 2',
  gridRowEnd: 'span footer',
  gridRowStart: '-1 footer',
} as const satisfies Style.LiteralProperties

/** Source includes A/B/A shorthand and longhand override applications. */
export const source = `import { css } from 'zyzz';
export const placement = css({gridArea:'1 / 2 / 3 / 4'})();
export const named = css({gridColumn:'start / end',gridRow:'1 / span 2'})();
export const first = css({gridColumn:'1 / 3'})();
export const second = css({gridColumnStart:2})();
export const third = css({gridColumn:'1 / 3',opacity:.5})();`
