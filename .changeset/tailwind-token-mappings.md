---
'zyzz': minor
---

Aligned non-font token categories, defaults, and fallback precedence with Tailwind while preserving typography and explicit spacing values.

```ts
import { Config } from 'zyzz'

const { style } = Config.create({
  vars: {
    radius: { card: '0.5rem' },
    breakpoint: { tablet: '48rem' },
    container: { panel: '32rem' },
  },
})
style({ borderRadius: 'card', maxWidth: 'panel' })
```
