---
'zyzz': patch
---

Accepted the Compat Standard `display` keywords `-webkit-box` and `-webkit-inline-box`, which `WebkitBoxOrient` and `WebkitLineClamp` require to truncate text after a number of lines.

```ts
const excerpt = style({
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 3,
  overflow: 'hidden',
})
```
