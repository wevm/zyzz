---
'zyzz': patch
---

Incremental graph compiles now reuse the extraction of every module that extracts as before an edit, and skip graph-wide work that an edit leaves unchanged, so editing one component recompiles that component instead of every module that imports it. In development, `zyzz/vite` announces each module update once until the environment loads it, keeps stylesheets current when a compiled-away theme begins to import a package, and leaves server stylesheets that no request transformed.
