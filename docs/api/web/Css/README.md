# Css

Pure web CSS emission.

```ts
import { Css } from 'zyzz/web'
```

## Methods

| API                       | Description                                                         |
| ------------------------- | ------------------------------------------------------------------- |
| [Css.compile](compile.md) | Compile ordered style data into CSS, class lists, and theme scopes. |

## Types and Errors

`Diagnostic`; `compile.ErrorType`, `compile.Options`, `compile.ReturnType`; `CompileError`.

See the [public declarations](../../../../src/web/Css.ts) for complete generic signatures and documented type properties.

`compile` supports scalar declarations and ordered nested selector/condition blocks.

Layer order uses the direct [`layers`](../layers.md) export from `zyzz/web`.
