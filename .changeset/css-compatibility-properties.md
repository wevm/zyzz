---
'zyzz': patch
---

Added typed support for inventoried CSS compatibility properties and automatic discovery of vendor prefixes and alternative names.

```ts
style({
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  rowRuleColor: 'repeat(2, red, blue)',
})
```
