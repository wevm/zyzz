# Config

Configuration-bound authoring and compatible variable scopes.

```ts
import { Config } from 'zyzz'
```

`defineConfig` is a root alias for `Config.create` and preserves its types.

```ts
import { defineConfig } from 'zyzz'

export const { style, vars } = defineConfig({
  vars: { color: { brand: '#123456' } },
})
```

## Methods

| API                        | Description                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Config.create](create.md) | Bind style authoring to explicit variable and layer contracts. Export helpers directly from `zyzz.config.ts` and consume them through named imports. |

[Config Script](script.md) documents `script()` for optional localStorage preference initialization.
