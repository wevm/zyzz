---
'zyzz': patch
---

Fixed theme references in `!custom` compound templates such as `boxShadow`, which failed extraction and now resolve per native set and scheme.

```ts
style({ boxShadow: `0px 2px 24px ${vars.color.shadow} !custom` })
```
