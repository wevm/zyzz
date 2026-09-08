# Vars.set

> [!NOTE]
> Preview API; not yet implemented.

Assign values to an explicit shared variable contract.

```ts
import { Vars } from 'zyzz'

const progress = Vars.define({ amount: 'percentage' })
const style = Vars.set(progress, { amount: '42%' })
```

## Signature

`Vars.set(definition, values)`

## Parameters

- `definition`: the shared contract returned by `Vars.define`.
- `values`: assignments to existing keys with compatible domains.

## Returns

An inline assignment object for the applied style override.

## Errors

Reject unknown keys and incompatible values. Private compiler-owned variables are not application override keys.

See [Vars](README.md) for related methods and types.
