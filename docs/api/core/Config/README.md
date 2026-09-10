# Config

> [!NOTE]
> The pure factory, normalized themes, and token/layer inference are implemented. Source compilation supports direct bound `css` calls and static theme members. Theme `vars` references are supported. Layer emission and variants remain planned.

Configuration-bound authoring and compatible theme scopes.

```ts
import { Config } from 'zyzz'
```

## Methods

| API                        | Description                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Config.create](create.md) | Bind style authoring to explicit theme and layer contracts. Export the config as `zyzz` from `zyzz.config.ts` and consume its members through a named import. |

[Config Script](script.md) documents `zyzz.script()` for optional localStorage preference initialization.
