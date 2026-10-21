---
'zyzz': patch
---

Compiled `cx` calls whose arguments are all known no-argument applications now select frozen props from a hoisted table instead of calling the runtime composition helper. Runtime compositions skip known inputs and emit smaller descriptors.
