---
'zyzz': patch
---

Replaced theme APIs with `Vars`, configurable variable sets, callable `vars` references and scope selection, and `vars` assignments.

```diff
-import { Theme, Config } from 'zyzz'
-const base = Theme.define({ color: { accent: '#2563eb' } })
-const { theme, themes } = Config.create({ themes: { base }, defaultTheme: 'base' })
-theme.tokens.color.accent
-themes({ theme: 'base', colorScheme: 'dark' })
-style({ variables: { [accent]: 'tomato' } })
-label({ variables: { [accent]: 'blue' } })
+import { Vars, Config } from 'zyzz'
+const base = Vars.define({ color: { accent: '#2563eb' } })
+const { vars } = Config.create({ vars: { base }, defaultVars: 'base' })
+vars.color.accent
+vars({ set: 'base', colorScheme: 'dark' })
+style({ vars: { [accent]: 'tomato' } })
+label({ vars: { [accent]: 'blue' } })
```
