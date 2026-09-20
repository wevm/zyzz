/**
 * Shares column and fragmentation sources with independent CSS controls.
 * @module
 */
/** Source exercises shared colors, numeric keywords, and fragment priority. */
export const source =
  "import { Config, style } from 'zyzz';\nconst zyzz = Config.create({vars:{color:{rule:'#06c'}}});\nexport const columns = zyzz.style({columnCount:2,columnWidth:'auto',columnGap:'12px',columnFill:'auto',columnRuleColor:'rule',columnRuleStyle:'solid',columnRuleWidth:'thin',orphans:2,widows:3})();\nexport const fragment = style({breakBefore:['auto','column !important'],breakAfter:'auto',breakInside:'avoid-column',columnSpan:'none'})();\nexport const spanning = style({columnSpan:'all',breakBefore:'auto'})();\nexport const automatic = style({columnCount:'auto',columnWidth:'80px',columnGap:'normal',columnFill:'balance'})();\n"

/** Native controls are authored independently from the compiler input. */
export const controls = {
  automatic:
    'column-count:auto;column-width:80px;column-gap:normal;column-fill:balance;',
  columns:
    'column-count:2;column-width:auto;column-gap:12px;column-fill:auto;column-rule-color:#06c;column-rule-style:solid;column-rule-width:thin;orphans:2;widows:3;',
  fragment:
    'break-before:column!important;break-after:auto;break-inside:avoid-column;column-span:none;',
  spanning: 'column-span:all;break-before:auto;',
} as const
