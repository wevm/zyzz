# Vite Setup

> [!NOTE]
> Initial Vite 8 integration. Supports physical JavaScript/TypeScript with static ES module imports within the Vite root. `Config.create`, dynamic source imports, cyclic graphs, and packed theme authoring remain unsupported.

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
- **Imports:** import source components normally. Use token-free `css` or `Theme.define`/`theme.css` within the current source subset; the named `zyzz` config instance remains planned.
- **Production:** run the existing build command; the adapter emits linked CSS assets.

No generated component imports or manual stylesheet import is required. Theme source is analyzed without executing application code. Vite owns alias resolution, TypeScript/JSX lowering, final CSS processing, and asset delivery.

Theme edits update generated CSS through Vite HMR. Missing source files report errors; restoring or creating the dependency recovers without restarting the server. Files outside the Vite root, dependency authoring, and virtual source modules remain separate integration gates.

See [Vite's plugin setup](https://vite.dev/guide/using-plugins) for the host configuration format.
