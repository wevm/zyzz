# Svelte Setup

> [!NOTE]
> Integration verification is in progress. The consumer fixtures cover styles in shared TypeScript modules and in component script blocks, SSR, hydration, reactive updates, themes, development CSS edits, production assets, packed-library consumers, and rename/remove/recreate recovery of style modules under the dev server.

Add Zyzz before the Svelte plugin:

```ts
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { zyzz } from 'zyzz/vite'

export default defineConfig({ plugins: [zyzz(), svelte()] })
```

```ts
// styles.ts
import { Config } from 'zyzz'
export const { css } = Config.create({ output: 'html' })
export namespace styles {
  export const card = css({ padding: '8px' })
}
```

```svelte
<script lang="ts">
import { styles } from './styles'
</script>

<div {...styles.card()}>Card</div>
```

Apply dynamic styles within the framework's reactive expression. The configured callable supplies native `class` and `style` attributes directly.

## Component Script Blocks

Styles can be authored inside a component's `<script>` blocks. The adapter compiles the top-level `<script module>` and instance `<script>` contents as one module before the Svelte plugin runs; the template never reaches the style compiler.

```svelte
<script module lang="ts">
import { css } from './styles'
const bar = css((values: { width: `${number}%` }) => ({
  height: '20px',
  width: values.width,
}))
</script>

<script lang="ts">
let width = $state<`${number}%`>('25%')
</script>

<div {...bar({ width })}></div>
```

- Imports declared in either block resolve for calls in the other, matching Svelte's shared scope.
- Declare component styles as plain `const` bindings. Svelte's script blocks strip types only, so `export namespace styles` stays in shared TypeScript modules.
- Each component keeps its module identity and receives its own stylesheet import. Script lines stay aligned with the component, so Svelte diagnostics and source maps keep their lines.
- A failing edit reports the component offset, keeps the last good stylesheet in the page, and recovers on the next successful save.

The test fixture pins Svelte 5.46.4 and @sveltejs/vite-plugin-svelte 7.3.0. Render benchmarks measure React only; the implementation plan tracks the remaining Svelte benchmark gate.
