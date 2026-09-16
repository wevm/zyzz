# Svelte Setup

> [!NOTE]
> Define styles in shared TypeScript modules. Inline style authoring inside component script blocks is not supported by this integration yet.

```ts
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { zyzz } from 'zyzz/vite'

export default defineConfig({ plugins: [zyzz(), svelte()] })
```

```ts
// styles.ts
import { Config } from 'zyzz'
export const { style } = Config.create({ output: 'html' })
export namespace styles {
  export const card = style({ padding: '8px' })
}
```

```svelte
<script lang="ts">
import { styles } from './styles'
</script>

<div {...styles.card()}>Card</div>
```

Apply dynamic styles within the framework's reactive expression. The configured callable supplies native `class` and `style` attributes directly. Framework fixtures exercise SSR, hydration identity, reactive updates, theme schemes, removed overrides, CSS edits, disposal, and production builds.

Packed variants cover defaults, payload updates and removal, conditional selections, and recovery after an invalid dependency edit. The Svelte plugin can report a missing default export during that deliberately failed update; the fixture requires rendering to recover and treats other lifecycle errors as failures.
