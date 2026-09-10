# Vue Setup

> [!NOTE]
> Integration verification is in progress. Define styles in shared TypeScript modules. Inline style authoring inside component script blocks is not supported by this integration yet.

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { zyzz } from 'zyzz/vite'

export default defineConfig({ plugins: [zyzz(), vue()] })
```

```ts
// styles.ts
import { Config } from 'zyzz'
export const { css } = Config.create({ output: 'html' })
export const styles = { card: css({ padding: '8px' }) }
```

```vue
<script lang="ts" setup>
import { styles } from './styles'
</script>

<div v-bind="styles.card()">Card</div>
```

Apply dynamic styles within the framework's reactive expression. The configured callable supplies native `class` and `style` attributes directly. Framework fixtures exercise SSR, hydration identity, reactive updates, theme schemes, removed overrides, CSS edits, disposal, and production builds.
