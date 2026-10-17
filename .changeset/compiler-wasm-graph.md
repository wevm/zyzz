---
'zyzz': patch
---

Added `zyzz/compiler/wasm`, which compiles web source graphs in browsers and Cloudflare Workers without the native addon. `Graph.create` takes the `zyzz/compiler.wasm` module, compiled or as bytes, and its `compile` takes the web options of `Graph.compile` and returns the same output. Failures throw `Graph.CompileError` with the native error's name, message, and diagnostics.

```ts
import { Graph } from 'zyzz/compiler/wasm'
// Workers import a `.wasm` file as a compiled module
import module from 'zyzz/compiler.wasm'

// Links a consumer to a library contract without the native addon
const output = Graph.create({ module }).compile({ contracts, imports, modules })
```
