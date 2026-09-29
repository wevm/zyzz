---
'zyzz': patch
---

Added `zyzz/oxlint` rules for style validation, logical properties, conflicting JSX props, unused namespace styles, and project property restrictions.

```ts
export default {
  lint: {
    jsPlugins: [{ name: 'zyzz', specifier: 'zyzz/oxlint' }],
    rules: { 'zyzz/valid-styles': 'error' },
  },
}
```
