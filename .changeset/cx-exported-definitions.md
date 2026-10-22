---
'zyzz': patch
---

Fixed `cx` applications of exported module-level `style` definitions, such as `cx(a(), b())` with `export const a = style(...)`, including definitions exported with `export { a }` and definitions declared after the composing function. Compilation previously failed with `Composition requires statically known local style applications.`
