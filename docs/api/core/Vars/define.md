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

`schema`: named `color`, `length`, `number`, or `percentage` domains.

## Returns

Typed variable references, such as `progress.amount`, usable in compatible style properties.

## Errors

Reject invalid schemas and incompatible use sites. Exact diagnostic names and CSS registration descriptors remain undecided.

Use callbacks for ordinary local dynamic values. Shared contracts are for bindings spanning definitions.

See [Vars](README.md) for related methods and types.
