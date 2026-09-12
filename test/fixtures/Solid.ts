/** Supplies a real Solid application for source, SSR, and browser integration. @module */

/** Pinned Solid compiler, renderer, and Vite plugin versions with their harness settings. */
export const options = {
  dependencies: { 'solid-js': '1.9.9', 'vite-plugin-solid': '2.11.8' },
  jsxImportSource: 'solid-js',
  name: 'solid',
  plugin: 'vite-plugin-solid',
  pluginOptions: { ssr: true },
}

const application = {
  'App.tsx': `import { createSignal, onMount } from 'solid-js';
import { styles, theme } from './styles';
export function App() {
  const [expanded, setExpanded] = createSignal(false);
  onMount(() => { document.documentElement.dataset.ready = 'true' });
  return <main style="width:400px"><section class={theme.className} style={{ 'color-scheme': expanded() ? 'dark' : 'light' }}>
    <div id="card" {...styles.card({ width: expanded() ? '75%' : '25%', ...(expanded() ? {} : { style: { marginTop: '12px', opacity: 0.5, '--note': '"<&>"' } }) })}>Card</div>
    <button id="toggle" onClick={() => setExpanded(value => !value)}>Toggle</button>
  </section></main>;
}`,
  'client.tsx': `import { hydrate } from 'solid-js/web'; import { App } from './App';
const scope = globalThis as { zyzzDispose?: () => void };
if (!scope.zyzzDispose) {
  const original = document.querySelector('#card');
  scope.zyzzDispose = hydrate(() => <App />, document.querySelector('#app')!);
  document.documentElement.dataset.identity = String(original === document.querySelector('#card'));
  document.querySelector('#dispose')!.addEventListener('click', () => scope.zyzzDispose!());
}
if (import.meta.hot) import.meta.hot.accept();`,
  'server.tsx': `import { generateHydrationScript, renderToString } from 'solid-js/web'; import { App } from './App';
export function render() { return { html: renderToString(() => <App />), script: generateHydrationScript() }; }`,
  'types.tsx': `import { styles } from './styles';
const attributes = styles.card({ width: '25%' });
const element = <div {...attributes} />;
// @ts-expect-error The dynamic width requires CSS percentage units.
styles.card({ width: 25 });
// @ts-expect-error Unknown value keys remain rejected through the adapter.
styles.card({ width: '25%', missing: true });
export { element };`,
}

const card = `export namespace styles {
  export const card = css((values: { width: \`\${number}%\` }) => ({ color: 'text', backgroundColor: '#0066cc', height: '20px', width: values.width }))
}`

/** Local configuration module imported by the shared style module. */
export const files = {
  ...application,
  'config.ts': `import { Config } from 'zyzz';
export const { css, theme } = Config.create({ output: 'html', theme: { color: { text: { light: '#000000', dark: '#ffffff' } } } });`,
  'styles.ts': `import { css, theme } from './config';
export { theme };
${card}`,
}

/** Styles bound to the packed HTML-output library instead of a local configuration. */
export const packedFiles = {
  ...application,
  'styles.ts': `import { css, theme } from '@acme/theme';
import '@acme/theme/style.css';
export { theme };
${card}`,
}
