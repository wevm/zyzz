---
'zyzz': patch
---

Required configured tokens by default and added bracketed strings for arbitrary CSS values.

```ts
const { style } = Config.create({ vars: { spacing: { md: '8px' } } })
style({ padding: 'md', marginTop: '[7px]' })
```
