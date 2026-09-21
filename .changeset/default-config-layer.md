---
'zyzz': patch
---

Added `Config.create({ defaultLayer })` to place styles and variants in a fallback CSS layer while preserving explicit layer blocks.

```ts
const { style, variants } = Config.create({
  defaultLayer: 'components',
  layers: ['components', 'overrides'],
})
```
