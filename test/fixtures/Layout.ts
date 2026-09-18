/**
 * Shares layout/containment sources and independently authored CSS controls.
 * @module
 */
/** Source combines legacy layout, containment, and explicit stacking priorities. */
export const source = `import { style } from 'zyzz';
export const floatBox = style({float:'left',width:'40px',height:'40px'})();
export const cleared = style({clear:'both',display:'flow-root'})();
export const context = style({contain:'layout',contentVisibility:'visible',isolation:'isolate',position:'relative',width:'100px',height:'100px'})();
export const front = style({position:'absolute',inset:0,zIndex:['auto','2 !important'],backfaceVisibility:'visible',transformStyle:'flat'})();
export const back = style({position:'absolute',inset:0,zIndex:1})();
export const image = style({objectFit:'cover',boxDecorationBreak:'clone'})();
`

/** Independent CSS controls establish expected property domains and cascade. */
export const controls = {
  back: 'position:absolute;inset:0;z-index:1;',
  cleared: 'clear:both;display:flow-root;',
  context:
    'contain:layout;content-visibility:visible;isolation:isolate;position:relative;width:100px;height:100px;',
  floatBox: 'float:left;width:40px;height:40px;',
  front:
    'position:absolute;inset:0;z-index:2!important;backface-visibility:visible;transform-style:flat;',
  image: 'object-fit:cover;box-decoration-break:clone;',
} as const
