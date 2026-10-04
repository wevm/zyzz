---
'zyzz': patch
---

Allowed functions to read `variable()` references declared later in the module.

```ts
import { style, variable } from 'zyzz'

export const plan = (accent: string) =>
  styles.plan({ vars: { [variables.accent]: accent } })

namespace variables {
  export const accent = variable('color')
}

namespace styles {
  export const plan = style({ color: variables.accent })
}
```
