---
'zyzz': minor
---

Added `Vars.compose` for CSS variable values containing live color, opacity, and length references.

```ts
Vars.compose('spacing', ['calc(', core.number.space, ' * 1px)'])
```
