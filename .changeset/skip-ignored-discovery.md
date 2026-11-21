---
'zyzz': patch
---

Discovery and the portable adapters' source scan now skip paths that `.gitignore` files ignore and the bundler's output directories, so stale bundles beside the sources are never parsed.
