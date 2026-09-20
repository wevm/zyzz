---
'zyzz': minor
---

Added border-width tokens and responsive typography sets with media and container queries.

```ts
import { Config } from 'zyzz'

const { style } = Config.create({
  theme: {
    borderWidth: { regular: '1px' },
    breakpoints: { tablet: '48rem' },
    typography: {
      heading: {
        fontSize: '24px',
        '@media >=tablet': { fontSize: '40px' },
      },
    },
  },
})
const title = style({ typography: 'heading', borderWidth: 'regular' })
```
