---
'zyzz': patch
---

Fixed `cx` applications of `namespace styles` members when the namespace also declares a non-exported `const` definition, such as a private `ring` composed by `style([{ color: '#fff' }, ring])`. Compilation previously failed with `Composition requires statically known local style applications.`
