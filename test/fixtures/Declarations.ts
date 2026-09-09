/**
 * Exercises ordered fallbacks, importance, and live theme references together.
 * @module
 */
/** Literal authoring shared by compiler, browser, and benchmark scenarios. */
export const source = `import { Theme } from 'zyzz';
const theme = Theme.define({color:{brand:'#06c'}});
const mint = Theme.extend(theme,{color:{brand:'#175'}});
const { css } = theme;
export const props = css({
  color: ['#000', theme.tokens.color.brand, 'brand!'],
  display: ['block', 'flex'],
  opacity: ['0.25 !important', 0.75],
  padding: ['4px!', '8px'],
  paddingLeft: '12px',
})();
export const later = css({color:'#fff',padding:'20px'})();
export const scope = mint.className;
`
