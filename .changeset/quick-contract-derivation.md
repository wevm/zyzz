---
'zyzz': patch
---

Sped up Vite builds that import packages without `.zyzz.json` sidecars. Deriving a package module's contract now resolves, reads, and parses its imports concurrently, so a barrel of a few hundred re-exports, such as an icon set, derives about 2.5x faster. The Vite plugin's `load`, `resolveId`, and `transform` hooks declare filters, so the bundler no longer calls them for dependencies and assets.
