/**
 * Shared source modules for graph integration and benchmarks.
 * @module
 */
export const modules = {
  'pkg/theme.ts': `import { Theme } from 'zyzz'; export const theme = Theme.define({color:{brand:'#06c'},spacing:{md:'8px',unused:'99px'}}); export const css = theme.css;`,
  'pkg/alternate.ts': `import { Theme } from 'zyzz'; import { theme } from './theme.js'; export const mint = Theme.extend(theme, {color:{brand:'#175'}});`,
  'pkg/index.ts': `export { theme, css as style } from './theme.js'; export * from './alternate.js';`,
  'pkg/card.ts': `import { theme, style, mint } from './index.js'; export const props = style({color:theme.tokens.color.brand,padding:'md'})(); export const scope = mint.className;`,
}
