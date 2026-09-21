---
'zyzz': patch
---

Added opt-in strict token validation and explicit custom CSS values.

```ts
const { style } = Config.create({
  strict: true,
  vars: { spacing: { md: '8px' } },
})
style({ padding: 'md', marginTop: { custom: '7px' } })
```
