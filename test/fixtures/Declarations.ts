/**
 * Exercises ordered fallbacks, importance, and live theme references together.
 * @module
 */
/** Literal authoring shared by compiler, browser, and benchmark scenarios. */
export const source =
  "import {Config} from 'zyzz';\nimport { Vars } from 'zyzz';\nconst theme = Vars.define({color:{brand:'#06c'}}); const themeConfig=Config.create({vars:theme});\nconst mint = Vars.extend(theme,{color:{brand:'#175'}}); const mintConfig=Config.create({vars:mint});\nconst { style } = theme;\nexport const props = style({\n  color: ['[#000]', theme.color.brand, 'brand !important'],\n  display: ['block', 'flex'],\n  opacity: ['0.25 !important', 0.75],\n  padding: ['4px !important', '8px'],\n  paddingLeft: '12px',\n})();\nexport const later = style({color:'[#fff]',padding:'20px'})();\nexport const scope = mintConfig.vars().className;\n"
