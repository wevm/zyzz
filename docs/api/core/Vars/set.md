# Vars.set

Assign values to an explicit shared variable contract.

```ts
import { Vars } from 'zyzz'

const progress = Vars.define({ amount: 'percentage' })
const style = Vars.set(progress, { amount: '42%' })
```

Preview API; not yet implemented.

## Signature

`Vars.set(definition, values)`

## Parameters

### definition

- Type: Shared contract returned by `Vars.define`
- Required: Yes.

Defines allowed assignment keys and domains.

```ts
Vars.set(progress, { amount: '42%' })
```

### values

- Type: Assignments to inferred contract keys
- Required: Yes.

Existing keys with compatible values. Compiler-owned private variables are not application override keys.

```ts
Vars.set(progress, { amount: '42%' })
```

## Returns

### style

- Type: Inline variable assignment object

Returned object can be supplied as the applied style override.

```ts
const style = Vars.set(progress, { amount: '42%' })
```

## Errors

Reject unknown keys and incompatible values. Private compiler-owned variables are not application override keys.

See [Vars](README.md) for related methods and types.
