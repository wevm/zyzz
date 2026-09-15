---
'zyzz': patch
---

Keep Next.js builds working when an installed dependency links back to the project or one of its ancestors, as a package linked from its own repository. Such a root is tracked through its files and subdirectories instead of a recursive context dependency that Turbopack rejects as a loop.
