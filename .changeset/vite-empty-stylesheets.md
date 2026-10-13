---
'zyzz': patch
---

Omitted the module stylesheet import from Vite builds when the module emits no CSS, so a chunk without styled modules no longer links an empty stylesheet.
