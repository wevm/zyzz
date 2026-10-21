---
'zyzz': patch
---

Rejected `fontWeight` tokens outside the `fontWeight` value domain in `defineConfig`. A numeric string such as `'500'` type-checked but dropped its token name, which left `fontWeight` accepting any literal. `defineConfig`, `Config.create`, and the compiler now report `Font weight token fontWeight.medium must be a number from 1 to 1000 or a fontWeight keyword, such as 500.`, and categories mapped to `fontWeight` follow the same rule.
