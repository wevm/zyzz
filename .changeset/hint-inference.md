---
'zyzz': patch
---

Improved type-checking performance of `style` and `variants` further. Editor hints are excluded from type argument inference and resolved once per token set instead of per call: about 30% faster checks on a large app. Accepted inputs, diagnostics and completions are unchanged.
