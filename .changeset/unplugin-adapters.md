---
'zyzz': minor
---

Added unplugin adapters for Rollup, Webpack, and esbuild with shared CSS output and access to the existing Vite integration.

```ts
import { zyzz } from 'zyzz/esbuild'

const plugins = [zyzz()]
```
