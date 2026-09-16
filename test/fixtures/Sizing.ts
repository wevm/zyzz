/**
 * Shares intrinsic sizing, literal/token precedence, and flex content fixtures.
 * @module
 */
/** Source exercises sizing keywords alongside ordinary dimensions and tokens. */
export const source = `import { Config, style } from 'zyzz';
const zyzz = Config.create({theme:{spacing:{'min-content':'24px',narrow:'40px'}}});
export const minimum = zyzz.style({inlineSize:'min-content'})();
export const maximum = style({inlineSize:'max-content'})();
export const fit = style({inlineSize:['100%','fit-content!'],minWidth:'auto',maxWidth:'none'})();
export const explicit = zyzz.style({width:zyzz.theme.tokens.spacing['min-content']})();
export const constrained = zyzz.style({minInlineSize:'narrow',maxInlineSize:'max-content',blockSize:'fit-content',minBlockSize:'auto',maxBlockSize:'none'})();
export const content = style({flexBasis:'content',width:'5px',flexShrink:0,minWidth:0})();
export const automatic = style({flexBasis:'auto',width:'5px',flexShrink:0,minWidth:0})();
`
