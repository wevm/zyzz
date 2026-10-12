---
'zyzz': patch
---

Fixed `style` objects and arrays with an invalid declaration typing their definition as a dynamic style. TypeScript now reports only the invalid declaration instead of also reporting `Expected 1 arguments, but got 0` at every application.
