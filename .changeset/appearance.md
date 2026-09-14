---
'zyzz': patch
---

Add `Appearance` to `zyzz/web` for applying, reading, restoring, and persisting the root theme selection, and inline each configuration's `script()` at the start of `index.html` from the Vite plugin so saved preferences apply before any other script runs. `zyzz({ script: false })` opts out.
