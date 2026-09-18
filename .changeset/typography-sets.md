---
'zyzz': patch
---

Added nested typography theme sets to `zyzz/default`.

```ts
import { style } from 'zyzz/default'

namespace styles {
  export const title = style({ typography: 'heading.32' })
  export const code = style({ typography: 'label.14.mono' })
}
```
