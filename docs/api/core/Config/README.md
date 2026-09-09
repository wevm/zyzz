# Config

Configuration-bound authoring and compatible theme scopes.

```ts
import { Config } from 'zyzz'
```

The pure factory, normalized themes, and token/layer inference are implemented. Source compilation supports direct bound `style` calls and static theme members. Layer emission, `vars`, and variants remain planned.

## Methods

| API                        | Description                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Config.create](create.md) | Bind style authoring to explicit theme and layer contracts. Export bound `style` and theme helpers from `zyzz.config.ts` for named consumer imports. |

[Config Script](script.md) documents `zyzz.script()` for optional localStorage preference initialization.
