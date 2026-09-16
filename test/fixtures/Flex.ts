/**
 * Shares flex sizing and overflow authoring across compiler and browser flows.
 * @module
 */
/** Source includes token sizing, ordered overflow fallbacks, and negative order. */
export const source = `import { Config, style } from 'zyzz';
const zyzz = Config.create({theme:{spacing:{item:'60px'}}});
export const container = style({display:'flex',flexWrap:'wrap',width:'180px',height:'100px',alignContent:'space-between',alignItems:'flex-start'})();
export const item = zyzz.style({flexBasis:['40px',zyzz.theme.tokens.spacing.item],flexGrow:0,flexShrink:0,height:'20px',alignSelf:'flex-end',order:'-1!'})();
export const clip = style({width:'40px',height:'40px',overflow:['hidden','clip!'],overflowX:'visible'})();
export const scroll = style({width:'40px',height:'40px',overflowX:'clip',overflow:'hidden',overflowY:'scroll'})();
`
