---
'zyzz': patch
---

Track Next.js package roots through their files and subdirectories instead of a recursive context dependency. Turbopack no longer follows every installed dependency from the project root, and a dependency symlink that targets an ancestor no longer fails the build as a loop.
