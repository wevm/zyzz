---
'zyzz': patch
---

Emit `color-scheme` selection classes in stylesheets whose modules reference `themes()`, `appearance`, or `script()`, and apply them from those helpers alongside the inline style. Bundlers that lower `light-dark()` into Lightning CSS helpers now initialize those helpers from the stylesheet, so precompiled output works under default browser targets without configuration.
