/**
 * Shared source modules for graph integration and benchmarks.
 * @module
 */
export const modules = {
  'pkg/theme.ts': `import { Vars } from 'zyzz'; export const theme = Vars.define({color:{brand:'#06c'},spacing:{md:'8px',unused:'99px'}});`,
  'pkg/alternate.ts': `import { Vars } from 'zyzz'; import { theme } from './theme.js'; export const mint = Vars.extend(theme, {color:{brand:'#175'}});`,
  'pkg/index.ts': `import { Config } from 'zyzz'; import { theme } from './theme.js'; import { mint } from './alternate.js'; export { theme, mint }; export const { style, vars }=Config.create({vars:{base:theme,mint},defaultVars:'base'});`,
  'pkg/card.ts': `import { vars, style } from './index.js'; export const props = style({color:vars.color.brand,padding:'md'})(); export const scope = vars({set:'mint'}).className;`,
}

/** Creates independent consumers of one shared theme graph. */
export function project(count: number): Record<string, string> {
  return {
    ...modules,
    ...Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        `pkg/card${index}.ts`,
        `import { style } from './index.js'; export const props = style({color:'brand',padding:'[${index}px]'})();`,
      ]),
    ),
  }
}
