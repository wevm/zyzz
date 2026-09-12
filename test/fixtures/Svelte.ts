/** Supplies a Svelte component with native reactive style spreading. @module */

/** Pinned Svelte compiler and Vite plugin versions with their harness settings. */
export const options = {
  dependencies: {
    svelte: '5.46.4',
    '@sveltejs/vite-plugin-svelte': '7.3.0',
  },
  name: 'svelte',
  plugin: '@sveltejs/vite-plugin-svelte',
  pluginExport: 'svelte',
}

const application = {
  'App.svelte': `<script lang="ts">
import { onMount } from 'svelte';
import { styles, theme } from './styles';
let expanded = $state(false);
onMount(() => { document.documentElement.dataset.ready = 'true' });
</script>
<main style="width:400px"><section class={theme.className} style:color-scheme={expanded ? 'dark' : 'light'}>
<div id="card" {...styles.card({ width: expanded ? '75%' : '25%', ...(expanded ? {} : { style: { marginTop: '12px', opacity: 0.5, '--note': '"<&>"' } }) })}>Card</div>
<button id="toggle" onclick={() => expanded = !expanded}>Toggle</button>
</section></main>`,
  'client.tsx': `import { flushSync, hydrate, unmount } from 'svelte'; import App from './App.svelte';
const scope = globalThis as { zyzzApp?: ReturnType<typeof hydrate> };
if (!scope.zyzzApp) {
  const original = document.querySelector('#card');
  scope.zyzzApp = hydrate(App, { target: document.querySelector('#app')! }); flushSync();
  document.documentElement.dataset.identity = String(original === document.querySelector('#card'));
  document.querySelector('#dispose')!.addEventListener('click', () => unmount(scope.zyzzApp!));
}
if (import.meta.hot) import.meta.hot.accept();`,
  'server.tsx': `import { render as renderComponent } from 'svelte/server'; import App from './App.svelte';
export function render() { const result = renderComponent(App); return { html: result.body, script: result.head }; }`,
  'types.tsx': `import type { HTMLAttributes } from 'svelte/elements'; import { styles } from './styles';
const attributes: HTMLAttributes<HTMLDivElement> = styles.card({ width: '25%' });
// @ts-expect-error Dynamic values retain their CSS unit contract.
styles.card({ width: 25 });
// @ts-expect-error Unknown values are rejected.
styles.card({ width: '25%', missing: true });
export { attributes };`,
}

const config = `import { Config } from 'zyzz';
export const { css, theme } = Config.create({ output: 'html', theme: { color: { text: { light: '#000000', dark: '#ffffff' } } } });`

const card = `export namespace styles {
  export const card = css((values: { width: \`\${number}%\` }) => ({ color: 'text', backgroundColor: '#0066cc', height: '20px', width: values.width }))
}`

/** Styles in a shared TypeScript module bound to a local configuration module. */
export const files = {
  ...application,
  'config.ts': config,
  'styles.ts': `import { css, theme } from './config';
export { theme };
${card}`,
}

/**
 * Styles authored inside the component's script blocks. The module block imports
 * the configured helper and defines the style; the instance block owns state. The
 * template keeps Svelte-only syntax that no TypeScript parser accepts.
 */
export const inlineFiles = {
  ...application,
  'App.svelte': `<script module lang="ts">
import { css } from './styles';
const card = css((values: { width: \`\${number}%\` }) => ({ color: 'text', backgroundColor: '#0066cc', height: '20px', width: values.width }));
</script>
<script lang="ts">
import { onMount } from 'svelte';
import { theme } from './styles';
let expanded = $state(false);
onMount(() => { document.documentElement.dataset.ready = 'true' });
</script>
<main style="width:400px"><section class={theme.className} style:color-scheme={expanded ? 'dark' : 'light'}>
<div id="card" {...card({ width: expanded ? '75%' : '25%', ...(expanded ? {} : { style: { marginTop: '12px', opacity: 0.5, '--note': '"<&>"' } }) })}>Card</div>
{#if expanded}<p id="note">Expanded</p>{/if}
<button id="toggle" onclick={() => expanded = !expanded}>Toggle</button>
</section></main>`,
  'styles.ts': config,
  'types.tsx': `import type { HTMLAttributes } from 'svelte/elements'; import { css } from './styles';
const card = css((values: { width: \`\${number}%\` }) => ({ color: 'text', backgroundColor: '#0066cc', height: '20px', width: values.width }));
const attributes: HTMLAttributes<HTMLDivElement> = card({ width: '25%' });
// @ts-expect-error Dynamic values retain their CSS unit contract.
card({ width: 25 });
// @ts-expect-error Unknown values are rejected.
card({ width: '25%', missing: true });
export { attributes };`,
}

/** Styles bound to the packed HTML-output library instead of a local configuration. */
export const packedFiles = {
  ...application,
  'styles.ts': `import { css, theme } from '@acme/theme';
import '@acme/theme/style.css';
export { theme };
${card}`,
}
