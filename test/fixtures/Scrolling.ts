/**
 * Shares scrolling declarations and CSS controls across compiler and browser flows.
 * @module
 */
import type { Style } from 'zyzz'

/** Independent CSS controls retain intentional shorthand/longhand order. */
export const controls = {
  behavior:
    'scroll-behavior:smooth;overscroll-behavior:contain;overscroll-behavior-x:none;overscroll-behavior-y:auto;',
  margin:
    'scroll-margin:1px;scroll-margin-block:2px;scroll-margin-block-end:-3px;scroll-margin-block-start:4px;scroll-margin-bottom:5px;scroll-margin-inline:6px;scroll-margin-inline-end:7px;scroll-margin-inline-start:-8px;scroll-margin-left:9px;scroll-margin-right:10px;scroll-margin-top:11px;',
  padding:
    'scroll-padding:1%;scroll-padding-block:2px;scroll-padding-block-end:auto;scroll-padding-block-start:4px;scroll-padding-bottom:5%;scroll-padding-inline:6px;scroll-padding-inline-end:7px;scroll-padding-inline-start:8px;scroll-padding-left:9px;scroll-padding-right:10px;scroll-padding-top:11px;',
} as const

/** Source covers tokens, per-entry maps, priority, and scroll-into-view offsets. */
export const source = `import { Config, style } from 'zyzz';
const zyzz = Config.create({theme:{spacing:{auto:'24px',offset:'20px'}}});
export const container = zyzz.style({
  overflow:'auto',height:'100px',width:'100px',scrollBehavior:'auto',
  scrollPaddingTop:['10px',zyzz.theme.tokens.spacing.offset],
  scrollPaddingInline:'auto',overscrollBehavior:['auto','contain!'],overscrollBehaviorX:'none'
})();
export const target = style({scrollMarginTop:'10px',height:'20px'})();
export const explicit = zyzz.style({scrollPaddingTop:zyzz.theme.tokens.spacing.auto})();
export const named = zyzz.style({scrollPaddingBlockStart:'offset!'})();
export const smooth = style({scrollBehavior:'smooth'})();
`

/** Complete property vocabulary; declaration order deliberately exercises overlap. */
export const styles = {
  behavior: {
    scrollBehavior: 'smooth',
    overscrollBehavior: 'contain',
    overscrollBehaviorX: 'none',
    overscrollBehaviorY: 'auto',
  },
  margin: {
    scrollMargin: '1px',
    scrollMarginBlock: '2px',
    scrollMarginBlockEnd: '-3px',
    scrollMarginBlockStart: '4px',
    scrollMarginBottom: '5px',
    scrollMarginInline: '6px',
    scrollMarginInlineEnd: '7px',
    scrollMarginInlineStart: '-8px',
    scrollMarginLeft: '9px',
    scrollMarginRight: '10px',
    scrollMarginTop: '11px',
  },
  padding: {
    scrollPadding: '1%',
    scrollPaddingBlock: '2px',
    scrollPaddingBlockEnd: 'auto',
    scrollPaddingBlockStart: '4px',
    scrollPaddingBottom: '5%',
    scrollPaddingInline: '6px',
    scrollPaddingInlineEnd: '7px',
    scrollPaddingInlineStart: '8px',
    scrollPaddingLeft: '9px',
    scrollPaddingRight: '10px',
    scrollPaddingTop: '11px',
  },
} as const satisfies Record<string, Style.LiteralProperties>
