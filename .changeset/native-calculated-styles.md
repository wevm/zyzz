---
'zyzz': patch
---

Added native length calculations using configured variables and scalar callback inputs.

```ts
import { style } from 'zyzz'

const artwork = style((input: { aspectRatio: number }) => ({
  height: `calc(440px / ${input.aspectRatio})`,
  width: 'calc(180px * 2 + 80px)',
}))

artwork({ aspectRatio: 2 })
```
