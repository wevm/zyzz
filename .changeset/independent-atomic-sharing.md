---
'zyzz': patch
---

Added `composition` to `defineConfig`, so independent atomic styles share one short-named rule per repeated declaration across modules.

```ts
export const { style } = defineConfig({ composition: 'independent' })
```
