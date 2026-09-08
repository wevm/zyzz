# Cascade Layers

> [!NOTE]
> Preview API; not yet implemented.

Declare layer order once in config. Bound styles infer the exact layer names.

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export default Config.create({ layers: ['reset', 'base', 'components'] })
```

```ts
import config from './zyzz.config.js'

const card = config.css({ '@layer components': { padding: '1rem' } })
```

Global modules may contribute rules independently. Their raw layer names receive compiler validation without ambient config inference.

```ts
import { global } from 'zyzz/web'

global({ '@layer base': { body: { margin: 0 } } })
```

The initial bundle contains the shared layer prelude. Conflicting order constraints fail; unlayered rules and important declarations retain standard CSS precedence. See [Global Styles](stylesheets.md) for collection behavior.
