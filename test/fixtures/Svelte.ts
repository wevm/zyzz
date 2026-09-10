/** Supplies a Svelte component with native reactive style spreading. @module */
export const files = {
  'App.svelte': `<script lang="ts">
import { onMount } from 'svelte';
import { styles, theme } from './styles';
let expanded = $state(false);
onMount(() => { document.documentElement.dataset.ready = 'true' });
</script>
<main style="width:400px"><section class={theme.className} style:color-scheme={expanded ? 'dark' : 'light'}>
<div id="card" {...styles.card({ width: expanded ? '75%' : '25%', ...(expanded ? {} : { style: { marginTop: '12px', opacity: 0.5, '--note': '"<&>' } }) })}>Card</div>
<button id="toggle" onclick={() => expanded = !expanded}>Toggle</button>
</section></main>`,
  'client.tsx': `import { flushSync, hydrate, unmount } from 'svelte'; import App from './App.svelte';
const original = document.querySelector('#card');
const app = hydrate(App, { target: document.querySelector('#app')! }); flushSync();
document.documentElement.dataset.identity = String(original === document.querySelector('#card'));
document.querySelector('#dispose')!.addEventListener('click', () => unmount(app));`,
  'server.tsx': `import { render as renderComponent } from 'svelte/server'; import App from './App.svelte';
export function render() { const result = renderComponent(App); return { html: result.body, script: result.head }; }`,
  'styles.ts': `import { Config } from 'zyzz';
export const { css, theme } = Config.create({ output: 'html', theme: { color: { text: { light: '#000000', dark: '#ffffff' } } } });
export const styles = {
  card: css((values: { width: \`\${number}%\` }) => ({ color: 'text', backgroundColor: '#0066cc', height: '20px', width: values.width })),
};`,
  'types.tsx': `import type { HTMLAttributes } from 'svelte/elements'; import { styles } from './styles';
const attributes: HTMLAttributes<HTMLDivElement> = styles.card({ width: '25%' });
// @ts-expect-error Dynamic values retain their CSS unit contract.
styles.card({ width: 25 });
// @ts-expect-error Unknown values are rejected.
styles.card({ width: '25%', missing: true });
export { attributes };`,
}
