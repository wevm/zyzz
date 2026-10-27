---
'zyzz': patch
---

Improved type-checking performance of configured `style` and `variants` further. Declaration values are now checked directly per property instead of through one-key objects, and lengths skip unit parsing unless a range rule needs it: about 12% fewer instantiations and 8% faster checks on a large app, and up to 35% fewer instantiations per call with the default theme. Accepted inputs and diagnostics are unchanged.
