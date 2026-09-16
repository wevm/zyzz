/**
 * Provides font controls and independently authored ruby and vertical text CSS.
 * @module
 */
export const controls = {
  font: 'font-kerning:normal;font-optical-sizing:auto;font-stretch:semi-expanded;font-synthesis-small-caps:none;font-synthesis-style:none;font-synthesis-weight:none;font-variant-caps:small-caps;font-variant-east-asian:jis04;font-variant-ligatures:no-common-ligatures;font-variant-numeric:tabular-nums;font-variant-position:normal;text-emphasis-color:#06c;text-emphasis-style:open circle;text-emphasis-position:over right;text-justify:inter-character',
  ruby: 'ruby-align:center;ruby-position:under',
  vertical:
    'writing-mode:vertical-rl;text-orientation:upright;text-combine-upright:none',
} as const

export const source = `import { Config, style } from 'zyzz';
const zyzz=Config.create({theme:{color:{accent:'#06c'}}});
export const font=zyzz.style({fontKerning:'normal',fontOpticalSizing:'auto',fontStretch:'semi-expanded',fontSynthesisSmallCaps:'none',fontSynthesisStyle:'none',fontSynthesisWeight:'none',fontVariantCaps:'small-caps',fontVariantEastAsian:'jis04',fontVariantLigatures:'no-common-ligatures',fontVariantNumeric:['normal','tabular-nums!'],fontVariantPosition:'normal',textEmphasisColor:'accent',textEmphasisStyle:'open circle',textEmphasisPosition:'over right',textJustify:'inter-character'})();
export const ruby=style({rubyAlign:'center',rubyPosition:'under'})();
export const vertical=style({writingMode:'vertical-rl',textOrientation:'upright',textCombineUpright:'none'})();`
