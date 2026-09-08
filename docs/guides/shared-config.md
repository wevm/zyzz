# Shared Configuration

> [!NOTE]
> Preview API; not yet implemented.

Keep reusable tokens outside config when several packages share them. Each application explicitly chooses its config contract.

```ts
// tokens.ts
import { Theme } from 'zyzz'

export const theme = Theme.define({ spacing: { md: '1rem' } })
```

```ts
// zyzz.config.ts
import { Config } from 'zyzz'
import { theme } from './tokens.js'

const config = Config.create({ theme })

export const { css, variants } = config
export default config
```

Import named helpers from a stable package export in consuming code. Preserve source/declaration exports so adapters can follow bindings. Independent theme definitions do not become compatible merely because their token paths match.

See [Publish Libraries](compilation.md) when sharing precompiled components rather than authoring configuration.
