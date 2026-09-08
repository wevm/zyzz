# Vars.define

> [!NOTE]
> Preview API; not yet implemented.

Create a shared contract for explicit CSS variable bindings.

```ts
import { Vars } from 'zyzz'

const progress = Vars.define({ amount: 'percentage' })
```

## Signature

`Vars.define(schema)`

## Parameters

### schema

- Type: Record of `color | length | number | percentage` domains
- Required: Yes.

Named shared variable contract. Use callbacks for ordinary local dynamic values.

```ts
Vars.define({ amount: 'percentage' })
```

## Returns

Returns typed references whose keys are inferred from the schema. Exact public type names remain undecided.

### [name]

- Type: Typed CSS variable reference

A reference for each schema key, usable in properties with a compatible domain.

```ts
progress.amount
```

## Errors

Reject invalid schemas and incompatible use sites. Exact diagnostic names and CSS registration descriptors remain undecided.

Use callbacks for ordinary local dynamic values. Shared contracts are for bindings spanning definitions.

See [Vars](README.md) for related methods and types.
