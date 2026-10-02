---
'zyzz': patch
---

Fixed shared native package compilation, composed token resolution, and font mapping delivery through Babel and Metro.

```ts
import { zyzz } from 'zyzz/metro'

export default zyzz(existingMetroConfig, {
  fonts: { 'Pilat, Arial, sans-serif': 'Pilat' },
  units: { px: 1, rem: 16 },
})
```
