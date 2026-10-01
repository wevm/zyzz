---
'zyzz': major
---

Replaced per-declaration CSS hashes with readable names, short module qualifiers, and consumer-owned namespaces.

```diff
-const { style, vars } = Config.create({ vars: tokens })
+const { style, vars } = Config.create({ id: 'app', vars: tokens })
```
