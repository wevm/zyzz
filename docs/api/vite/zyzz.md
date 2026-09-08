# zyzz

> [!NOTE]
> Initial Vite 8 integration. Supports physical JavaScript/TypeScript with static ES module imports within the Vite root. `Config.create`, dynamic source imports, cyclic graphs, and packed theme authoring remain unsupported.

Connect source transformation and CSS delivery to Vite.

```ts
import { defineConfig } from 'vite'
import { zyzz } from 'zyzz/vite'

export default defineConfig({ plugins: [zyzz()] })
```

## Signature

`zyzz()`

## Parameters

No parameters. Root, aliases, resolution conditions, browser targets, and CSS processing come from the existing Vite configuration.

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

Authoring inside virtual modules, framework SFCs, dependencies, or files outside the Vite root is not supported yet. See [Vite Setup](../../introduction/vite.md).

See [zyzz/vite](README.md) for the entrypoint overview.
