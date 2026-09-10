/** Supplies a real Solid application for source, SSR, and browser integration. @module */
export const files = {
  'App.tsx': `import { createSignal, onMount } from 'solid-js';
import { Attrs } from 'zyzz/web';
import { styles, theme } from './styles';
export function App() {
  const [expanded, setExpanded] = createSignal(false);
  onMount(() => { document.documentElement.dataset.ready = 'true' });
  return <main style="width:400px"><section {...Attrs.from(theme({ colorScheme: expanded() ? 'dark' : 'light' }))}>
    <div id="card" {...Attrs.from(styles.card({ width: expanded() ? '75%' : '25%', ...(expanded() ? {} : { style: { marginTop: '12px', opacity: 0.5, '--note': '"<&>' } }) }))}>Card</div>
    <button id="toggle" onClick={() => setExpanded(value => !value)}>Toggle</button>
  </section></main>;
}`,
  'client.tsx': `import { hydrate } from 'solid-js/web'; import { App } from './App';
const element = document.querySelector('#app')!;
const original = document.querySelector('#card');
const dispose = hydrate(() => <App />, element);
document.documentElement.dataset.identity = String(original === document.querySelector('#card'));
document.querySelector('#dispose')!.addEventListener('click', () => dispose());`,
  'server.tsx': `import { generateHydrationScript, renderToString } from 'solid-js/web'; import { App } from './App';
export function render() { return { html: renderToString(() => <App />), script: generateHydrationScript() }; }`,
  'styles.ts': `import { Config } from 'zyzz';
export const { css, theme } = Config.create({ theme: { color: { text: { light: '#000000', dark: '#ffffff' } } } });
export const styles = {
  card: css((values: { width: \`\${number}%\` }) => ({ color: 'text', backgroundColor: '#0066cc', height: '20px', width: values.width })),
};`,
  'types.tsx': `import { Attrs } from 'zyzz/web'; import { styles } from './styles';
const attributes = Attrs.from(styles.card({ width: '25%' }));
const element = <div {...attributes} />;
// @ts-expect-error The dynamic width requires CSS percentage units.
styles.card({ width: 25 });
// @ts-expect-error Unknown value keys remain rejected through the adapter.
Attrs.from(styles.card({ width: '25%', missing: true }));
export { element };`,
}
