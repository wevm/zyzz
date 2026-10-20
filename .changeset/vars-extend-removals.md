---
'zyzz': patch
---

Added path removal to `Vars.extend`. `null` at an existing leaf or category removes it from the extension's references, `style` tokens, and emitted CSS. A removal of a missing path, or a `null` inside a leaf, throws `Vars.InvalidError`.

```ts
const site = Vars.extend(
  base,
  { radius: { '3xl': null, '4xl': null }, shadow: null },
  { id: 'site/vars' },
)
```
