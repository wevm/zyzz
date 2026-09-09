/**
 * Shares table sources and independently authored browser controls.
 * @module
 */
import type { Style } from 'zyzz'

/** Native CSS controls include both border models and declaration priority. */
export const controls = {
  collapsed:
    'border-collapse:collapse;border-spacing:12px;caption-side:top;empty-cells:show;table-layout:auto;',
  separated:
    'border-collapse:separate;border-spacing:8px!important;caption-side:bottom;empty-cells:hide;table-layout:fixed;',
  zero: 'border-collapse:separate;border-spacing:0;caption-side:top;empty-cells:show;table-layout:fixed;',
} as const

/** Source preserves ordered fallbacks and scalar length spelling. */
export const source = `import { css } from 'zyzz';
export const collapsed = css({borderCollapse:'collapse',borderSpacing:'12px',captionSide:'top',emptyCells:'show',tableLayout:'auto'})();
export const separated = css({
  borderCollapse:'separate',borderSpacing:['2px','8px!','4px'],
  captionSide:'bottom',emptyCells:'hide',tableLayout:'fixed'
})();
export const zero = css({borderCollapse:'separate',borderSpacing:0,captionSide:'top',emptyCells:'show',tableLayout:'fixed'})();
`

/** Public table declarations retain a bounded property and value surface. */
export const styles = {
  collapsed: { borderCollapse: 'collapse', tableLayout: 'auto' },
  separated: {
    borderCollapse: 'separate',
    borderSpacing: '1em',
    captionSide: 'bottom',
    emptyCells: 'hide',
    tableLayout: 'fixed',
  },
} as const satisfies Record<string, Style.Properties>
