/**
 * Provides named colors, token-name collisions, and paired color schemes.
 * @module
 */
export const source =
  "import { Config, style } from 'zyzz';\nconst zyzz=Config.create({vars:{color:{red:'blue',accent:{dark:'gold',light:'coral'}}}});\nexport const literal=zyzz.style({color:'red !custom',backgroundColor:zyzz.vars.color.red,fill:'rebeccapurple !custom',stroke:'navy !custom',accentColor:'coral !custom',caretColor:'tomato !custom',columnRuleColor:'gray !custom',textDecorationColor:'grey !custom',textEmphasisColor:'papayawhip !custom',borderColor:'aliceblue !custom'})();\nexport const theme=zyzz.style({color:'accent'})();\nexport const fallback=style({color:['navy','rebeccapurple !important']})();\nexport const system=style({color:'CanvasText',backgroundColor:'Canvas',colorScheme:'light dark',forcedColorAdjust:'none'})();"
