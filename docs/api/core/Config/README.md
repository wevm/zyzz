# Config

> [!NOTE]
> The pure factory, normalized themes, and token/layer inference are implemented. Config source extraction and layer emission remain planned; bound `css` execution still requires that integration.

Configuration-bound authoring and compatible theme scopes.

```ts
import { Config } from 'zyzz'
```

## Methods

| API                        | Description                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Config.create](create.md) | Bind style authoring to explicit theme and layer contracts. Export the config as `zyzz` from `zyzz.config.ts` and consume its members through a named import. |
