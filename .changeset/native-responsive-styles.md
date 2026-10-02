---
'zyzz': minor
---

Added automatic window subscriptions and responsive native styles and variable reads.

```ts
import { defineConfig } from 'zyzz/react-native'

const { Provider, style } = defineConfig({
  vars: { breakpoint: { md: '768px' } },
})

const panel = style({
  flexDirection: 'column',
  '@media md': { flexDirection: 'row' },
})
```
