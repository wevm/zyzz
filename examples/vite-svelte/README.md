# Svelte + Vite

```sh
pnpm examples
```

Run from the repository root after `pnpm install`. The command builds Zyzz, then starts every example's dev server. After building or linking, `pnpm dev` also works from this directory.

`@sveltejs/vite-plugin-svelte` compiles components and Zyzz handles styles with `plugins: [zyzz(), svelte()]`. The config selects `output: 'html'`, so applied styles return `class` and a serialized `style` string that Svelte spreads as native attributes.

Zyzz compiles JavaScript and TypeScript modules, so each component keeps its definitions in a sibling `*.styles.ts` module with `export namespace styles {}` and spreads the applied props in markup:

```svelte
<script lang="ts">
  import { styles } from './Button.styles.js'
</script>

<button {...styles.button()}>Continue</button>
```

Spread expressions re-run when their `$state` inputs change, so `styles.bar({ width: `${amount}%` })` updates its bound variable in place.

## Feature Map

| Source                                    | Capabilities                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/zyzz.config.ts`                      | Named themes, light/dark pairs, extensions, tokens, aliases, property-specific scales, layers    |
| `src/App.svelte` / `src/App.styles.ts`    | Theme selection, system scheme, nested scopes, global CSS in a named layer                       |
| `src/Styling.svelte` / `.styles.ts`       | Literal reuse, object spread, fallbacks, importance, token/variable references, state, overrides |
| `src/Dynamic.svelte` / `.styles.ts`       | Typed runtime inputs, `variable()`, registration, static and inline `variables`                  |
| `src/Relationships.svelte` / `.styles.ts` | Empty `css()`, `selectors`, hover, data attributes, nth-child, sibling selectors, `:has()`       |
| `src/Queries.svelte` / `.styles.ts`       | Media/container aliases, resize control, supports, scope boundaries                              |
| `src/Motion.svelte` / `.styles.ts`        | Local/imported keyframes, relative assets, starting styles, reduced motion, `{#key}` remount     |
| `src/main.ts`                             | Optional reset, client mount                                                                     |

This client-rendered example does not demonstrate SSR hydration; the repository's Svelte integration test covers server rendering through `@sveltejs/vite-plugin-svelte`.
