---
'zyzz': patch
---

Fixed Vite analysis of server-only protocol imports such as `cloudflare:workers` before TanStack Start removed them from client code. Resolvable protocol imports remained available for static style analysis, and unresolved ordinary file and package imports continued to report errors.
