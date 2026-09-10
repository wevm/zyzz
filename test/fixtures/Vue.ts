/** Supplies a Vue SFC application with native attribute binding. @module */
export const files = {
  'App.vue': `<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { styles, theme } from './styles';
const expanded = ref(false);
const attributes = computed(() => styles.card({ width: expanded.value ? '75%' : '25%', ...(expanded.value ? {} : { style: { marginTop: '12px', opacity: 0.5, '--note': '"<&>' } }) }));
onMounted(() => { document.documentElement.dataset.ready = 'true' });
</script>
<template><main style="width:400px"><section :class="theme.className" :style="{ colorScheme: expanded ? 'dark' : 'light' }">
<div id="card" v-bind="attributes">Card</div><button id="toggle" @click="expanded = !expanded">Toggle</button>
</section></main></template>`,
  'client.tsx': `import { createSSRApp } from 'vue'; import App from './App.vue';
const original = document.querySelector('#card');
const app = createSSRApp(App); app.mount('#app');
document.documentElement.dataset.identity = String(original === document.querySelector('#card'));
document.querySelector('#dispose')!.addEventListener('click', () => app.unmount());`,
  'server.tsx': `import { createSSRApp } from 'vue'; import { renderToString } from 'vue/server-renderer'; import App from './App.vue';
export async function render() { return { html: await renderToString(createSSRApp(App)), script: '' }; }`,
  'styles.ts': `import { Config } from 'zyzz';
export const { css, theme } = Config.create({ output: 'html', theme: { color: { text: { light: '#000000', dark: '#ffffff' } } } });
export const styles = {
  card: css((values: { width: \`\${number}%\` }) => ({ color: 'text', backgroundColor: '#0066cc', height: '20px', width: values.width })),
};`,
  'types.tsx': `import type { HTMLAttributes } from 'vue'; import { styles } from './styles';
const attributes: HTMLAttributes = styles.card({ width: '25%' });
// @ts-expect-error Dynamic values retain their CSS unit contract.
styles.card({ width: 25 });
// @ts-expect-error Unknown values are rejected.
styles.card({ width: '25%', missing: true });
export { attributes };`,
}
