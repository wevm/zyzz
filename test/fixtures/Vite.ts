/**
 * Supplies a physical Vite application with aliased themes and static props.
 * @module
 */
/** Physical application sources shared by builds, HMR checks, and benchmarks. */
export const files = {
  'alternate.ts': `import { Theme } from 'zyzz'; import { theme } from '@theme'; export const mint = Theme.extend(theme, { color: { brand: '#175' } });`,
  'card.ts': `import { theme } from '@theme'; export const props = theme.css({ color: 'brand', padding: '8px' })();`,
  'index.html': `<main id="scope"><div id="card">Card</div></main><script type="module" src="/main.ts"></script>`,
  'main.ts': `import { props } from './card'; import { mint } from './alternate'; document.querySelector('#scope')!.className = mint.className; document.querySelector('#card')!.className = props.className; if (import.meta.hot) import.meta.hot.accept();`,
  'theme.ts': `import { Theme } from 'zyzz'; export const theme = Theme.define({ color: { brand: '#06c' } });`,
}

/** Lazy application; Vite loads and watches the styled module on demand. */
export const lazyFiles = {
  ...files,
  'index.html': `<button id="load">Load</button><main id="scope"><div id="card">Card</div></main><script type="module" src="/main.ts"></script>`,
  'lazy.ts': `import { props } from './card'; import { mint } from './alternate';
export function render() { document.querySelector('#scope')!.className = mint.className; document.querySelector('#card')!.className = props.className; }
if (import.meta.hot) import.meta.hot.accept(module => module?.render());`,
  'main.ts': `document.querySelector('#load')!.addEventListener('click', async () => { const { render } = await import('./lazy'); render(); });`,
}
