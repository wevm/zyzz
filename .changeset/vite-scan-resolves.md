---
'zyzz': patch
---

Marked the Vite plugin's development import resolves as scans, so the dependency optimizer no longer discovers packages that only compiler analysis reaches, and plugins can tell that analysis apart from module graph imports.
