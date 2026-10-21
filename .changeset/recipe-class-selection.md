---
'zyzz': patch
---

Added `selection: 'class'` to `variants` definitions. Each selected choice then adds its own generated class instead of a `data-*` attribute, so applications return only `className` and `style`. Rules keep their order and `:where()` specificity, so defaults, `null`, compounds, conditions, payloads, and `cx` resolve as with attribute selection.
