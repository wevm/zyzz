# Vite Setup

> [!NOTE]
> Preview API; not yet implemented.

Add the adapter to the existing Vite configuration. Retain the application's framework plugin.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { Vite } from 'zyzz/vite'

export default defineConfig({
  plugins: [Vite.create()],
})
```

- **Development:** run the existing dev command; edits update transformed modules and CSS.
- **Imports:** consume the default-exported [config](getting-started.md#define-config) and source components normally.
- **Production:** run the existing build command; the adapter emits linked CSS assets.

No generated component imports or manual virtual stylesheet import are part of this proposed setup. Config is analyzed as static data; application code is not executed for discovery.

See [Vite's plugin setup](https://vite.dev/guide/using-plugins) for the host configuration format.
