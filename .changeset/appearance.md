---
'zyzz': patch
---

Add `appearance` to `Config.create` results with `get()` and `set()` for reading and persisting the root theme and scheme on the document element, and a `storageKey` option shared with `script()`. The Vite plugin inlines each configuration's `script()` at the start of `index.html` so saved preferences apply before any other script runs; `zyzz({ script: false })` opts out.
