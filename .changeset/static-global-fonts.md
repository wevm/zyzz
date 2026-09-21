---
'zyzz': patch
---

Added static token values in stylesheet contributions and package font URL resolution in Vite.

```ts
import { global } from 'zyzz/web'

const tokens = { fontFamily: { sans: 'Geist' } }

global({ body: { fontFamily: tokens.fontFamily.sans } })
```
