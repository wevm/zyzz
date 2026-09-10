# Config

> [!NOTE]
> The pure factory, normalized themes, and token/layer inference are implemented. Source compilation supports named helpers, callable theme selection, initialization scripts, variables, and layers. Variants remain planned.

Configuration-bound authoring and compatible theme scopes.

```ts
import { Config } from 'zyzz'
```

## Methods

| API                        | Description                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Config.create](create.md) | Bind style authoring to explicit theme and layer contracts. Export helpers directly from `zyzz.config.ts` and consume them through named imports. |

[Config Script](script.md) documents `script()` for optional localStorage preference initialization.
