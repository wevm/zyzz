# Configuration

> [!NOTE]
> Preview API; not yet implemented.

`Config.create` binds authoring functions to explicit tokens and layers. Default-export the config from `zyzz.config.ts` and import that instance normally. The compiler reads static data without executing application code.

```ts
import { Config } from 'zyzz'

export default Config.create({
  layers: ['base', 'components'],
  theme: { spacing: { md: '1rem' } },
})
```

- **Layers:** infer keys such as `@layer components`; unknown names fail.
- **No theme:** authoring stays token-free.
- **One theme:** accepts inline tokens or a reusable `Theme.define` value.
- **Several themes:** use `themes` with a required `defaultTheme`.

Named alternatives share the default's token paths and domains. Config returns compatible handles without mutating independent definitions. Imports outside that config receive no ambient tokens or layer types.

```ts
import config from './zyzz.config.js'

const card = config.css({ padding: 'md' })
```

Default export is a convention, not a mandatory filename or runtime registration mechanism. Compiler linking must preserve inference through imported instance members and supported aliases.
