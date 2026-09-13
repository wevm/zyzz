/** Supplies a Svelte component with native reactive style spreading. @module */
export const files = {
  'App.svelte': `<script lang="ts">
import { onMount } from 'svelte';
import { button, styles, theme } from './styles';
let expanded = $state(false);
onMount(() => { document.documentElement.dataset.ready = 'true' });
</script>
<main style="width:400px"><section class={theme.className} style:color-scheme={expanded ? 'dark' : 'light'}>
<div id="card" {...styles.card({ width: expanded ? '75%' : '25%', ...(expanded ? {} : { style: { marginTop: '12px', opacity: 0.5, '--note': '"<&>"' } }) })}>Card</div>
<button id="recipe" {...button(expanded ? { size: { custom: { padding: '12px' } }, active: true, conditions: { wide: { active: false } } } : {}, expanded)}>Recipe</button>
<button id="empty" {...button({ size: null }, false)}>Empty</button>
<button id="toggle" onclick={() => expanded = !expanded}>Toggle</button>
</section></main>`,
  'client.tsx': `import { flushSync, hydrate, unmount } from 'svelte'; import App from './App.svelte';
const original = document.querySelector('#card');
const originalRecipe = document.querySelector('#recipe');
const app = hydrate(App, { target: document.querySelector('#app')! }); flushSync();
document.documentElement.dataset.identity = String(original === document.querySelector('#card') && originalRecipe === document.querySelector('#recipe'));
document.querySelector('#dispose')!.addEventListener('click', () => unmount(app));`,
  'server.tsx': `import { render as renderComponent } from 'svelte/server'; import App from './App.svelte';
export function render() { const result = renderComponent(App); return { html: result.body, script: result.head }; }`,
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
  'types.tsx': `import type { HTMLAttributes } from 'svelte/elements'; import { button, styles } from './styles';
const attributes: HTMLAttributes<HTMLDivElement> = styles.card({ width: '25%' });
// @ts-expect-error Dynamic values retain their CSS unit contract.
styles.card({ width: 25 });
// @ts-expect-error Unknown values are rejected.
styles.card({ width: '25%', missing: true });
// @ts-expect-error Dynamic choices require payloads.
button({ size: 'custom' }, true);
// @ts-expect-error Payload units survive the exported wrapper.
button({ size: { custom: { padding: 12 } } }, true);
export { attributes };`,
}
