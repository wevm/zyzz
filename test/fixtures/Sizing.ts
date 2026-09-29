/**
 * Shares intrinsic sizing, literal/token precedence, and flex content fixtures.
 * @module
 */
/** Source exercises sizing keywords alongside ordinary dimensions and tokens. */
export const source =
  "import { Config, style } from 'zyzz';\nconst zyzz = Config.create({vars:{spacing:{'min-content':'24px',narrow:'40px'}}});\nexport const minimum = zyzz.style({inlineSize:'min-content !custom'})();\nexport const maximum = style({inlineSize:'max-content'})();\nexport const fit = style({inlineSize:['100%','fit-content !important'],minWidth:'auto',maxWidth:'none'})();\nexport const explicit = zyzz.style({width:zyzz.vars.spacing['min-content']})();\nexport const constrained = zyzz.style({minInlineSize:'narrow',maxInlineSize:'max-content !custom',blockSize:'fit-content !custom',minBlockSize:'auto !custom',maxBlockSize:'none !custom'})();\nexport const content = style({flexBasis:'content',width:'5px',flexShrink:0,minWidth:0})();\nexport const automatic = style({flexBasis:'auto',width:'5px',flexShrink:0,minWidth:0})();\n"
