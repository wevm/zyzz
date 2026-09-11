# Vars

Explicit shared variable contracts.

```ts
import { Vars } from 'zyzz'
```

## Authoring and assignments

| API                      | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| [Vars.define](define.md) | Create a shared contract for explicit CSS variable bindings. |
| [vars.set](set.md)       | Assign values to an explicit shared variable contract.       |

Module-level contracts retain style references and assignments through source imports, aliases, re-exports, and packed metadata. Registration descriptors add CSS `@property` rules with explicit inheritance and defaults. Native bindings remain deferred.

### MissingTransformError

`Vars.MissingTransformError` extends `Error` and is thrown if `Vars.define` executes before source rewriting. Its stable `name` is `Vars.MissingTransformError`; its message identifies the required compile-time transform.

Types: `Vars.Schema`, `Vars.Definition<schema>`, `Vars.References<schema>`, `Vars.Values<schema>`, `Vars.Registration`, and `Vars.Initial<kind>`. A definition combines readonly references with its bound `set` method.
