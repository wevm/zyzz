# Vite Setup

> [!NOTE]
> Initial Vite 8 integration. Supports physical JavaScript/TypeScript within the Vite root, including lazy-loaded modules. Named `Config.create` instances are supported. Cyclic static graphs remain unsupported. Packed theme authoring requires compiler metadata.

Add the adapter to the existing Vite configuration. Retain the application's framework plugin.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { zyzz } from 'zyzz/vite'

export default defineConfig({
  plugins: [zyzz()],
})
```

- **Development:** run the existing dev command; edits update transformed modules and CSS.
- **Imports:** import source components normally. Import token-free `css` or named `{ css, theme }` helpers from config.
- **Production:** run the existing build command; the adapter emits linked CSS assets.

No generated component imports or manual stylesheet import is required. Theme source is analyzed without executing application code. Vite owns alias resolution, TypeScript/JSX lowering, final CSS processing, and asset delivery.

Theme edits update generated CSS through Vite HMR. Missing source files report errors; restoring or creating the dependency recovers without restarting the server. Files outside the Vite root, dependency authoring, and virtual source modules remain separate integration gates.

See [Vite's plugin setup](https://vite.dev/guide/using-plugins) for the host configuration format.

## Lazy Modules

Vite loads and transforms lazy modules, including their CSS. Production builds retain Vite's CSS code splitting. Theme bindings inside each module must use static imports; dynamically loading an authoring theme for use in `css` is unsupported.

```ts
// main.ts
const { props } = await import('./card')
element.className = props.className

// card.ts
import { theme } from './theme'
export const props = theme.css({ color: 'brand' })()
```

## Configuration

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export const { css, theme } = Config.create({
  theme: { color: { brand: '#06c' } },
})
```

```ts
// card.ts
import { css, theme } from './zyzz.config.js'

export const styles = {
  card: css({ color: 'brand' }),
}
element.className = `${theme.className} ${styles.card().className}`
```

`defaultTheme` selects shorthand token fallbacks for named catalogs. Use `themes({ theme: 'mint' })` to select a scope, with an optional `colorScheme` override. Config edits rebuild dependent styles. Direct literal calls, immutable aliases, and named re-exports are supported. Dynamic member access, escaping config objects, and variants remain unsupported.

## Theme Libraries

Publish the [graph contract](../api/compiler/Graph/compile.md#contracts) next to each exported JavaScript entrypoint: `index.js.zyzz.json` beside `index.js`. Vite resolves package exports and aliases; Zyzz reads the adjacent metadata without evaluating the library. Raw dependency source extraction remains unsupported.

Exclude authoring packages from dependency optimization so Vite retains the original entrypoint and its metadata:

```ts
export default defineConfig({
  build: { cssTarget: ['chrome123', 'firefox128', 'safari17.5'] },
  optimizeDeps: { exclude: ['@acme/theme'] },
  plugins: [zyzz()],
})
```

```ts
import { css, mint } from '@acme/theme'
import '@acme/theme/style.css'

const styles = {
  card: css({ color: 'brand' }),
}
element.className = `${mint.className} ${styles.card().className}`
```

Light/dark pairs require final CSS targets with native `light-dark()` support. The profile above preserves it; Vite's default minification targets can lower it to scheme helper variables, which do not preserve arbitrary inherited or inline `color-scheme` selection. Zyzz does not override the host's target policy.

Import the library stylesheet for its precompiled components. App-authored styles receive matching scopes through the plugin. Publish JavaScript, declarations, CSS, and metadata from the same build. Restart Vite after replacing an installed package; dependency watching follows Vite's normal exclusions.
