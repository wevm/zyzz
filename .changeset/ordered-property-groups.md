---
'zyzz': patch
---

Added configurable ordered token lookup through `propertyGroups`, replacing `mappings`.

```ts
import { Config } from 'zyzz'

Config.create({
  vars: { spacing: { small: '4px' }, container: { wide: '640px' } },
  propertyGroups: { width: ['spacing', 'container'] },
})
```
