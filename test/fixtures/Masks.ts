/**
 * Provides mask/position declarations and independently authored CSS controls.
 * @module
 */
export const control =
  'background-position:right;image-rendering:pixelated;mask-clip:padding-box;mask-composite:add;mask-mode:alpha;mask-origin:padding-box;mask-position:left;mask-repeat:no-repeat;mask-size:50%;mask-type:alpha;object-position:bottom;perspective:300px;perspective-origin:center;shape-margin:5%;transform-box:border-box;transform-origin:right'

export const source = `import { style } from 'zyzz';
export const mask=style({backgroundPositionX:'10px',backgroundPosition:'right',imageRendering:'pixelated',maskClip:'padding-box',maskComposite:'add',maskMode:'alpha',maskOrigin:'padding-box',maskPosition:'left',maskRepeat:'no-repeat',maskSize:['auto','50% !important'],maskType:'alpha',objectPosition:'bottom',perspective:'300px',perspectiveOrigin:'center',shapeMargin:'5%',transformBox:'border-box',transformOrigin:'right'})();
export const axis=style({backgroundPositionX:'20px'})();`
