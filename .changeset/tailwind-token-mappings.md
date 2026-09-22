---
'zyzz': patch
---

Aligned non-font token mappings and fallback precedence with Tailwind while preserving Geist colors, typography, and explicit spacing values.

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
