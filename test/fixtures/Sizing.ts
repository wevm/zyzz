/**
 * Shares intrinsic sizing, literal/token precedence, and flex content fixtures.
 * @module
 */
/** Source exercises sizing keywords alongside ordinary dimensions and tokens. */
export const source = `import { Config, css } from 'zyzz';
const zyzz = Config.create({theme:{spacing:{'min-content':'24px',narrow:'40px'}}});
export const minimum = zyzz.css({inlineSize:'min-content'})();
export const maximum = css({inlineSize:'max-content'})();
export const fit = css({inlineSize:['100%','fit-content!'],minWidth:'auto',maxWidth:'none'})();
export const explicit = zyzz.css({width:zyzz.theme.tokens.spacing['min-content']})();
export const constrained = zyzz.css({minInlineSize:'narrow',maxInlineSize:'max-content',blockSize:'fit-content',minBlockSize:'auto',maxBlockSize:'none'})();
export const content = css({flexBasis:'content',width:'5px',flexShrink:0,minWidth:0})();
export const automatic = css({flexBasis:'auto',width:'5px',flexShrink:0,minWidth:0})();
`
