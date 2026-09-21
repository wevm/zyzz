---
'zyzz': patch
---

Added static token values in stylesheet contributions and package font URL resolution in Vite.

```ts
import { tokens } from 'zyzz/default'
import { global } from 'zyzz/web'

global({ body: { fontFamily: tokens.fontFamily.sans } })
```
