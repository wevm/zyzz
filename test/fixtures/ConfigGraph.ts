/**
 * Provides named configuration modules shared by integration and benchmark flows.
 * @module
 */
/** Mixed reusable and inline alternatives, with an explicitly non-first default. */
export const modules = {
  'pkg/base.ts': `import { Theme } from 'zyzz'; export const base = Theme.define({color:{brand:{light:'#06c',dark:'#9cf'}},spacing:{md:'8px'}});`,
  'pkg/zyzz.config.ts': `import { Config } from 'zyzz'; import { base } from './base.js'; export const zyzz = Config.create({defaultTheme:'base',layers:['reset','components'],themes:{mint:{color:{brand:{light:'#175',dark:'#afa'}},spacing:{md:'12px'}},base}});`,
  'pkg/index.ts': `export { zyzz as design } from './zyzz.config.js';`,
  'pkg/card.ts': `import { design } from './index.js'; const zyzz = design; const { style } = zyzz; export const props = style({color:zyzz.themes.base.tokens.color.brand,padding:'md'})(); export const scope = zyzz.themes.mint.className;`,
}
