---
'zyzz': patch
---

Added `zyzz/runtime` to `optimizeDeps.include` in Vite development environments that discover dependencies and resolve the runtime inside `node_modules`. The first request for a compiled module no longer re-runs the dependency optimizer, which could leave server and browser modules with separate copies of a shared dependency such as React.
