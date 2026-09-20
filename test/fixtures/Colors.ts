/**
 * Provides named colors, token-name collisions, and paired color schemes.
 * @module
 */
export const source =
  "import { Config, style } from 'zyzz';\nconst zyzz=Config.create({vars:{color:{red:'blue',accent:{dark:'gold',light:'coral'}}}});\nexport const literal=zyzz.style({color:'red',backgroundColor:zyzz.vars.color.red,fill:'rebeccapurple',stroke:'navy',accentColor:'coral',caretColor:'tomato',columnRuleColor:'gray',textDecorationColor:'grey',textEmphasisColor:'papayawhip',borderColor:'aliceblue'})();\nexport const theme=zyzz.style({color:'accent'})();\nexport const fallback=style({color:['navy','rebeccapurple !important']})();\nexport const system=style({color:'CanvasText',backgroundColor:'Canvas',colorScheme:'light dark',forcedColorAdjust:'none'})();"
