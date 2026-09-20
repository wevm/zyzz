---
'zyzz': patch
---

Added a derived-values callback to `Vars.define` with deep merging and live references across variable-set overrides.

```ts
const vars = Vars.define({ color: { ink: '#171717' } }, (vars) => ({
  color: { foreground: vars.color.ink },
}))
```
