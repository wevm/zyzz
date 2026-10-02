---
'zyzz': major
---

Renamed `Provider.set` to `Provider.vars` and added `useVars(vars, selector?)` for readonly native values selected by the nearest Provider.

```diff
-<Provider colorScheme="dark" set="blue">
+<Provider colorScheme="dark" vars="blue">
   <App />
 </Provider>
```
