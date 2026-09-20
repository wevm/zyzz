/** Supplies a real Solid application for source, SSR, and browser integration. @module */
export const files = {
  'App.tsx': `import { createSignal, onMount } from 'solid-js';
import { styles, theme, variant } from './styles';
export function App() {
  const [expanded, setExpanded] = createSignal(false);
  onMount(() => { document.documentElement.dataset.ready = 'true' });
  return <main style="width:400px"><section class={theme().class} style={{ 'color-scheme': expanded() ? 'dark' : 'light' }}>
    <div id="card" {...styles.card({ width: expanded() ? '75%' : '25%', ...(expanded() ? {} : { style: { marginTop: '12px', opacity: 0.5, '--note': '"<&>"' } }) })}>Card</div>
    <div id="variant" {...variant(expanded())}>Variant</div>
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
  'styles.ts':
    "import { Config, cx } from 'zyzz';\nimport {controls} from '@acme/variants';\nimport '@acme/variants/style.css';\nexport function variant(expanded:boolean){return cx(controls.button({size:expanded?{custom:{padding:'20px'}}:undefined,active:expanded,conditions:{wide:{size:'lg'}}}),controls.override())}\nexport const { style, vars:theme } = Config.create({ output: 'html', vars: { color: { text: { light: '#000000', dark: '#ffffff' } } } });\nexport namespace styles {\n  export const card = style((values: { width: `${number}%` }) => ({ color: 'text', backgroundColor: '#0066cc', height: '20px', width: values.width }))\n}",
  'types.tsx': `import { styles } from './styles';
const attributes = styles.card({ width: '25%' });
const element = <div {...attributes} />;
// @ts-expect-error The dynamic width requires CSS percentage units.
styles.card({ width: 25 });
// @ts-expect-error Unknown value keys remain rejected through the adapter.
styles.card({ width: '25%', missing: true });
export { element };`,
}
