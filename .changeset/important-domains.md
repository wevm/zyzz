---
'zyzz': patch
---

Improved type-checking performance of `style`, `variants` and the web rule helpers. Property domains accept any spaced ` !important` spelling and the unmarked value is checked once, instead of every literal and token carrying an important variant: about 9% fewer instantiations on a large app and 10-50% fewer in most type benches. Accepted inputs and diagnostics are unchanged.
