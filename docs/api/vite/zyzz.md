# zyzz

> [!NOTE]
> Initial Vite 8 integration. Supports physical JavaScript/TypeScript within the Vite root, including lazy-loaded modules. Named `Config.create` instances are supported. Cyclic static graphs remain unsupported. Packed theme authoring requires compiler metadata.

Connect source transformation and CSS delivery to Vite.

```ts
import { defineConfig } from 'vite'
import { zyzz } from 'zyzz/vite'

export default defineConfig({ plugins: [zyzz()] })
```

## Signature

`zyzz(options?)`

## Parameters

Optional `compiler`, `native`, and `script` settings; see [Options](#options). Root, aliases, resolution conditions, browser targets, and CSS processing come from the existing Vite configuration.

## Browser Targets

Theme colours require native `light-dark()` support. With no explicit build target, CSS defaults to Chrome/Edge 123, Firefox 120, and Safari 17.5. Target validation also covers application stylesheets. Explicit incompatible or unverifiable targets produce an error during configuration. An ECMAScript build target requires a separate browser `build.cssTarget`. Vendor prefixing and other Lightning CSS transforms remain enabled.

## Returns

### plugin

- Type: `Plugin` from `vite`

Connects development updates and linked production CSS delivery using the existing Vite resolver, module graph, watcher, and CSS pipeline. Compiler state is isolated per environment.

```ts
defineConfig({ plugins: [zyzz()] })
```

## Errors

Source/target errors must remain located; failed development builds preserve the previous complete output.

The adapter statically analyzes source; it does not execute theme factories at build time. Each virtual stylesheet includes its reachable source graph so compatible theme scopes are available. Shared rules can repeat before Vite’s final CSS processing.

Raw authoring inside virtual modules, framework SFCs, dependencies, or files outside the Vite root is not supported yet. Packed dependencies can supply adjacent compiler metadata; exclude their authoring entrypoints from Vite dependency optimization. See [Vite Setup](../../introduction/vite.md).

See [zyzz/vite](README.md) for the entrypoint overview.

## Initialization Script

Each exported configuration's [`script()`](../core/Config/script.md) is inlined at the start of `index.html`'s `<head>`, before Vite's client and every application module. Saved theme and scheme preferences therefore apply before first paint. Development compiles the catalog when the page is requested; production reads it from the bundled modules.

```ts
defineConfig({
  plugins: [zyzz({ script: false })],
})
```

Each script reads the localStorage entry named by its configuration's `storageKey`, the same record `appearance.set()` writes. `script: false` skips injection for documents that inline the script themselves. Applications without `index.html`, such as server-rendered frameworks, keep inlining `script()` in their document.

## Options

`zyzz({ compiler?: boolean, script?: boolean })` enables source optimization and script injection by default. With `compiler: false`, the plugin still extracts and delivers CSS but retains authoring calls. Variables, dynamic definitions, variants, theme configurations, and named stylesheet declarations require explicit IDs. See [CLI](../../introduction/cli.md) for authoring examples.

## Native Output

```ts
zyzz({ native: { colorScheme: 'dark', platform: 'ios' } })
```

`native` accepts the [graph compiler context](../compiler/Graph/compile.md) and captures it when the plugin is created. Native mode emits modules and maps without virtual CSS imports or initialization scripts. It skips browser CSS target configuration and requires source compilation. Restart the build to change native context.

Vite still owns module resolution and bundling. This option does not provide a Metro adapter or device rendering. Web output remains the default.
