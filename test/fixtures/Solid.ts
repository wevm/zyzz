/** Supplies a real Solid application for source, SSR, and browser integration. @module */
export const files = {
  'App.tsx': `import { createSignal, onMount } from 'solid-js';
import { button, styles, theme } from './styles';
export function App() {
  const [expanded, setExpanded] = createSignal(false);
  onMount(() => { document.documentElement.dataset.ready = 'true' });
  return <main style="width:400px"><section class={theme.className} style={{ 'color-scheme': expanded() ? 'dark' : 'light' }}>
    <div id="card" {...styles.card({ width: expanded() ? '75%' : '25%', ...(expanded() ? {} : { style: { marginTop: '12px', opacity: 0.5, '--note': '"<&>"' } }) })}>Card</div>
    <button id="recipe" {...button(expanded() ? { size: { custom: { padding: '12px' } }, active: true, conditions: { wide: { active: false } } } : {}, expanded())}>Recipe</button>
<button id="empty" {...button({ size: null }, false)}>Empty</button>
<button id="toggle" onClick={() => setExpanded(value => !value)}>Toggle</button>
  </section></main>;
}`,
  'client.tsx': `import { hydrate } from 'solid-js/web'; import { App } from './App';
const element = document.querySelector('#app')!;
const original = document.querySelector('#card');
const originalRecipe = document.querySelector('#recipe');
const dispose = hydrate(() => <App />, element);
document.documentElement.dataset.identity = String(original === document.querySelector('#card') && originalRecipe === document.querySelector('#recipe'));
document.querySelector('#dispose')!.addEventListener('click', () => dispose());`,
  'server.tsx': `import { generateHydrationScript, renderToString } from 'solid-js/web'; import { App } from './App';
export function render() { return { html: renderToString(() => <App />), script: generateHydrationScript() }; }`,
  'styles.ts': `import { Config, cx } from 'zyzz';
export const { css, theme, variants } = Config.create({ output: 'html', theme: { color: { text: { light: '#000000', dark: '#ffffff' } } } });
const recipe = variants({
  base: { padding: '2px', borderWidth: '0px', fontWeight: 400 },
  conditions: { wide: '@media (width >= 600px)' },
  variants: {
    size: { sm: { padding: '4px' }, custom: (values: { padding: \`\${number}px\` }) => ({ padding: values.padding }) },
    active: { true: { opacity: 0.5 }, false: { opacity: 1 } }
  },
  defaultVariants: { size: 'sm', active: false },
  compoundVariants: [{ when: { size: 'custom', active: true }, style: { fontWeight: 700 } }]
});
const accent = css({ paddingLeft: '3px' });
export function button(selection: Parameters<typeof recipe>[0], highlight: boolean) {
  return cx(recipe(selection), highlight && accent())
}
export namespace styles {
  export const card = css((values: { width: \`\${number}%\` }) => ({ color: 'text', backgroundColor: '#0066cc', height: '20px', width: values.width }))
}`,
  'types.tsx': `import { button, styles } from './styles';
const attributes = styles.card({ width: '25%' });
const element = <div {...attributes} />;
// @ts-expect-error The dynamic width requires CSS percentage units.
styles.card({ width: 25 });
// @ts-expect-error Unknown value keys remain rejected through the adapter.
styles.card({ width: '25%', missing: true });
// @ts-expect-error Dynamic choices require payloads.
button({ size: 'custom' }, true);
// @ts-expect-error Payload units survive the exported wrapper.
button({ size: { custom: { padding: 12 } } }, true);
export { element };`,
}
