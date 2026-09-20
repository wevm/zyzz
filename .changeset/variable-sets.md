---
'zyzz': minor
---

Added shared variable sets with conditional values, configurable property mappings, typed references, and scoped selection.

```ts
const base = Variables.define({ color: { accent: '#2563eb' } })
const alternate = Variables.extend(base, { color: { accent: '#9333ea' } })
const { style, variables, vars } = Config.create({
  variables: { base, alternate },
  defaultVariables: 'base',
})
```
