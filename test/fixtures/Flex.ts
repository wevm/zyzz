/**
 * Shares flex sizing and overflow authoring across compiler and browser flows.
 * @module
 */
/** Source includes token sizing, ordered overflow fallbacks, and negative order. */
export const source =
  "import { Config, style } from 'zyzz';\nconst zyzz = Config.create({vars:{spacing:{item:'60px'}}});\nexport const container = style({display:'flex',flexWrap:'wrap',width:'180px',height:'100px',alignContent:'space-between',alignItems:'flex-start'})();\nexport const item = zyzz.style({flexBasis:['[40px]',zyzz.vars.spacing.item],flexGrow:0,flexShrink:0,height:'[20px]',alignSelf:'flex-end',order:'-1 !important'})();\nexport const clip = style({width:'40px',height:'40px',overflow:['hidden','clip !important'],overflowX:'visible'})();\nexport const scroll = style({width:'40px',height:'40px',overflowX:'clip',overflow:'hidden',overflowY:'scroll'})();\n"
