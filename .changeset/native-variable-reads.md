---
'zyzz': major
---

Added native `defineConfig` with a typed `Provider` and `useVars(vars, selector?)`, and renamed `Provider.set` to `Provider.vars`.

```diff
-import { defineConfig } from 'zyzz'
-import { Provider } from 'zyzz/react-native/react'
+import { defineConfig } from 'zyzz/react-native/react'

-const { style, variants, vars } = defineConfig(options)
+const { Provider, style, variants, vars } = defineConfig(options)

-<Provider colorScheme="dark" set="blue">
+<Provider colorScheme="dark" vars="blue">
   <App />
 </Provider>
```
