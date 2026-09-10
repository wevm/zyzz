# Vars

Explicit shared variable contracts.

```ts
import { Vars } from 'zyzz'
```

## Methods

| API                      | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| [Vars.define](define.md) | Create a shared contract for explicit CSS variable bindings. |
| [Vars.set](set.md)       | Assign values to an explicit shared variable contract.       |

Contracts currently require module-level constants and local style references. Runtime assignments may use exported compiled contracts. Imported references in style definitions, native bindings, and `@property` registration remain deferred.

### MissingTransformError

`Vars.MissingTransformError` extends `Error` and is thrown if `Vars.define` executes before source rewriting. Its stable `name` is `Vars.MissingTransformError`; its message identifies the required compile-time transform.
