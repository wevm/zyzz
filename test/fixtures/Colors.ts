/**
 * Provides named colors, token-name collisions, and paired color schemes.
 * @module
 */
export const source = `import { Config, css } from 'zyzz';
const zyzz=Config.create({theme:{color:{red:'blue',accent:{dark:'gold',light:'coral'}}}});
export const literal=zyzz.css({color:'red',backgroundColor:zyzz.theme.tokens.color.red,fill:'rebeccapurple',stroke:'navy',accentColor:'coral',caretColor:'tomato',columnRuleColor:'gray',textDecorationColor:'grey',textEmphasisColor:'papayawhip',borderColor:'aliceblue'})();
export const theme=zyzz.css({color:'accent'})();
export const fallback=css({color:['navy','rebeccapurple!']})();
export const system=css({color:'CanvasText',backgroundColor:'Canvas',colorScheme:'light dark',forcedColorAdjust:'none'})();`
