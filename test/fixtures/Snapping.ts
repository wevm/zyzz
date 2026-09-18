/**
 * Shares scroll snap authoring and independently specified browser controls.
 * @module
 */
import type { Style } from 'zyzz'

/** Native CSS controls for both physical scroll axes and ordered importance. */
export const controls = {
  horizontal:
    'display:flex;gap:40px;overflow:auto;width:100px;height:100px;scroll-padding:10px;scroll-snap-type:x mandatory;',
  item: 'width:60px;height:60px;flex-shrink:0;scroll-margin:5px;scroll-snap-align:start;scroll-snap-stop:always!important;',
  vertical:
    'display:flex;flex-direction:column;gap:40px;overflow:auto;width:100px;height:100px;scroll-padding:10px;scroll-snap-type:y mandatory;',
} as const

/** Source exercises token padding, snap fallback order, and two-axis alignment. */
export const source = `import { Config, style } from 'zyzz';
const zyzz = Config.create({theme:{spacing:{edge:'10px'}}});
export const horizontal = zyzz.style({
  display:'flex',gap:'40px',overflow:'auto',width:'100px',height:'100px',
  scrollPadding:'edge',scrollSnapType:['x proximity','x mandatory !important']
})();
export const vertical = style({display:'flex',flexDirection:'column',gap:'40px',overflow:'auto',width:'100px',height:'100px',scrollPadding:'10px',scrollSnapType:'y mandatory'})();
export const item = style({width:'60px',height:'60px',flexShrink:0,scrollMargin:'5px',scrollSnapAlign:'start',scrollSnapStop:['normal','always !important']})();
export const pair = style({scrollSnapAlign:'none center',scrollSnapType:'both proximity'})();
`

/** Valid authored declarations are checked through the public in-memory boundary. */
export const styles = {
  horizontal: { scrollSnapType: 'x mandatory' },
  item: {
    scrollSnapAlign: ['none', 'start end !important'],
    scrollSnapStop: 'always',
  },
  logical: {
    scrollSnapType: 'inline proximity',
    scrollSnapAlign: 'none center',
  },
  vertical: { scrollSnapType: 'block', scrollSnapStop: 'normal' },
} as const satisfies Record<string, Style.Properties>
