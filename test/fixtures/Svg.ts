/**
 * Provides SVG paint declarations and independently authored native controls.
 * @module
 */
export const controls = {
  filter:
    'flood-color:#06c;flood-opacity:0.25;lighting-color:white;color-interpolation-filters:linearRGB',
  paint:
    'fill:#06c;fill-opacity:0.5;fill-rule:evenodd;stroke:black;stroke-width:4px;stroke-opacity:0.75;stroke-linecap:round;stroke-linejoin:bevel;stroke-miterlimit:2;stroke-dashoffset:-5%;clip-rule:evenodd;paint-order:stroke;shape-rendering:geometricPrecision;text-rendering:optimizeLegibility;vector-effect:non-scaling-stroke',
} as const

export const source =
  "import { Config, style } from 'zyzz';\nconst zyzz = Config.create({vars:{color:{ink:'#06c'}}});\nexport const paint = zyzz.style({fill:'ink',fillOpacity:0.5,fillRule:['nonzero','evenodd !important'],stroke:'black !custom',strokeWidth:'4px',strokeOpacity:0.75,strokeLinecap:'round',strokeLinejoin:'bevel',strokeMiterlimit:2,strokeDashoffset:'-5%',clipRule:'evenodd',paintOrder:'stroke',shapeRendering:'geometricPrecision',textRendering:'optimizeLegibility',vectorEffect:'non-scaling-stroke'})();\nexport const filter = zyzz.style({floodColor:'ink',floodOpacity:0.25,lightingColor:'white !custom',colorInterpolationFilters:'linearRGB'})();\nexport const empty = style({fill:'none',stroke:'none'})();"
