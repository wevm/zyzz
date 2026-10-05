---
'zyzz': patch
---

Fixed React Native views committing their shadow tree on every mount and re-render by attaching native style bindings only when a Provider change first patches them.
