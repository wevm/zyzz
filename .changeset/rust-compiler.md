---
'zyzz': patch
---

Moved the compiler to Rust. `Css.compile`, `Source.extract`, `Transform.compile`, `Native.compile`, and `Graph` run in a native addon with byte-identical output. Browser bundles that import `Css.compile` inline a WebAssembly build of the compiler.
