---
'zyzz': patch
---

Added external import patterns to standalone compilation and additional source directories to the Vite integration.

```ts
await Host.create({ external: ['~icons/*'], packageId: 'vocs', root: 'src' })
zyzz({ include: ['../library/src'] })
```
