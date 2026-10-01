---
'zyzz': major
---

Replaced hashed CSS names with readable names and consumer-owned namespaces.

```diff
-const { style, vars } = Config.create({ vars: tokens })
+const { style, vars } = Config.create({ id: 'app', vars: tokens })
```
