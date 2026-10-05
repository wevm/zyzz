---
'zyzz': patch
---

Expanded the CSS `flex` shorthand into native `flexGrow`, `flexShrink`, and `flexBasis` with CSS defaults instead of rejecting it.

```ts
style({ flex: 1 }) // flexGrow 1, flexShrink 1, flexBasis 0
```
