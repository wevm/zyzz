# targets

Keep theme colours native in a Vite build that consumes precompiled Zyzz output.

```ts
import { defineConfig } from 'vite'
import { targets } from 'zyzz/vite'

export default defineConfig({ plugins: [targets()] })
```

## Signature

`targets()`

## Parameters

No parameters. Browser targets come from the existing Vite configuration.

## Browser Targets

Output from the [CLI](../cli.md) or [Host](../node/Host/README.md) contains native `light-dark()`. Vite's default `build.cssTarget` predates that function, so Lightning CSS lowers it into helpers that inline and inherited `color-scheme` changes cannot initialize.

With no explicit build target, this plugin defaults CSS to Chrome/Edge 123, Firefox 120, and Safari 17.5 and excludes the Lightning `light-dark()` transform. Explicit incompatible or unverifiable targets produce an error during configuration. `zyzz()` includes the same behavior; use `targets()` only when the plugin is absent.

## Returns

### plugin

- Type: `Plugin` from `vite`

Configuration hooks only; no source transformation or CSS extraction.

```ts
defineConfig({ plugins: [targets()] })
```

## Errors

Configuration fails when `build.cssTarget` or `css.lightningcss.targets` would lower `light-dark()`.

See [zyzz/vite](README.md) for the entrypoint overview.
