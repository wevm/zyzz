---
'zyzz': patch
---

Added full variable paths in compatible CSS properties with `mappings: false`.

```ts
const { style } = Config.create({
  vars: { surface: { foreground: '#123456' } },
  mappings: false,
})
const text = style({ color: 'surface.foreground' })
```
