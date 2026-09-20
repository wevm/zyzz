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
- **Imports:** import source components normally. Import token-free `style` or named `{ style, vars }` helpers from config.
- **Production:** run the existing build command; the adapter emits linked CSS assets.

No generated component imports or manual stylesheet import is required. Theme source is analyzed without executing application code. Vite owns alias resolution, TypeScript/JSX lowering, final CSS processing, and asset delivery.

Named theme configurations also get their preference [initialization script](../api/vite/zyzz.md#initialization-script) inlined at the start of `index.html`'s `<head>`, so saved themes and schemes apply before first paint. Pass `zyzz({ script: false })` to opt out.

Theme edits update generated CSS through Vite HMR. Missing source files report errors; restoring or creating the dependency recovers without restarting the server. Files outside the Vite root, dependency authoring, and virtual source modules remain separate integration gates.

See [Vite's plugin setup](https://vite.dev/guide/using-plugins) for the host configuration format.

## Lazy Modules

Vite loads and transforms lazy modules, including their CSS. Production builds retain Vite's CSS code splitting. Theme bindings inside each module must use static imports; dynamically loading an authoring theme for use in `style` is unsupported.

```ts
// main.ts
const { props } = await import('./card')
element.className = props.className

// card.ts
import { Config } from 'zyzz'
import { theme } from './theme'
const config = Config.create({ vars: theme })
export const props = config.style({ color: 'brand' })()
```

## Configuration

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export const { style, vars } = Config.create({
  vars: { color: { brand: '#06c' } },
})
```

```ts
// card.ts
import { style, vars } from './zyzz.config.js'

export namespace styles {
  export const card = style({ color: 'brand' })
}
element.className = `${theme.className} ${styles.card().className}`
```

`defaultVars` selects shorthand token fallbacks for named catalogs. Use `vars({ set: 'mint' })` to select a scope, with an optional `colorScheme` override. Config edits rebuild dependent styles. Direct literal calls, immutable aliases, and named re-exports are supported. Dynamic member access, escaping config objects, and variants remain unsupported.

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
import { mint, style } from '@acme/theme'
import '@acme/theme/styles.css'

namespace styles {
  export const card = style({ color: 'brand' })
}
element.className = `${mint.className} ${styles.card().className}`
```

Zyzz preserves native `light-dark()` for inherited and inline scheme changes, including application stylesheets. CSS targets default to Chrome/Edge 123, Firefox 120, and Safari 17.5 when no build target is supplied. Bundlers without this plugin may lower `light-dark()`; compiled scheme classes carry `color-scheme` in the stylesheet, so lowered output still resolves. Explicit browser targets are retained; incompatible or unverifiable targets produce an error. An ECMAScript build target requires a separate browser `build.cssTarget`.

Import the library stylesheet for its precompiled components. App-authored styles receive matching scopes through the plugin. Publish JavaScript, declarations, CSS, and metadata from the same build. Restart Vite after replacing an installed package; dependency watching follows Vite's normal exclusions.
