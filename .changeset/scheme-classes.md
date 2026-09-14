---
'zyzz': patch
---

Emit `color-scheme` selection classes beside theme scopes and apply them from `themes()` and `script()` alongside the inline style. Bundlers that lower `light-dark()` into Lightning CSS helpers now initialize those helpers from the stylesheet, so precompiled output works under default browser targets without configuration.
