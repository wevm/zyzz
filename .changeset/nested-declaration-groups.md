---
"zyzz": patch
---
Replaced declaration helper `within` options with nested at-rule keys.

```ts
import { fontFace } from 'zyzz/web'

fontFace({
  '@layer base': {
    fontFamily: 'Body',
    src: 'url(/body.woff2)',
  },
})
```
