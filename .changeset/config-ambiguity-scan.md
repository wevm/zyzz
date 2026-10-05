---
'zyzz': patch
---

Fixed `defineConfig` scanning every CSS property for each variable token when no `mappings` are configured, which slowed module evaluation for large token sets.
