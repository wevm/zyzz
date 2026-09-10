# Freeze

Compiler-generated variable contracts use `Freeze` from `zyzz/runtime` to avoid capturing consumer globals. Applications normally use `Vars.define` and let the compiler supply this helper.

## create

`Freeze.create(value)` accepts an object and returns the same object as `Readonly<value>`, shallowly frozen with `Object.freeze`. Nested values are frozen separately by generated code. It does not generate CSS or validate CSS values. It can throw the standard `Object.freeze` errors for unsupported objects, such as nonempty typed arrays.

```ts
import { Freeze } from 'zyzz/runtime'
const reference = Freeze.create({ name: '--example', type: 'length', variable: true })
```
