# Css.layers

> [!NOTE]
> Preview API; not yet implemented.

Contribute an ordered set of cascade layer names.

```ts
import { Css } from 'zyzz/web'

Css.layers(['reset', 'base', 'components'])
```

## Signature

`Css.layers(names)`

## Parameters

`names`: static ordered CSS layer names, merged with other project order contributions.

## Returns

A stylesheet order contribution. No layer-reference return object is required by the authoring contract.

## Errors

Reject invalid names and contradictory order cycles with source locations.

Bound `@layer` inference derives from config, not ambient global declarations. Normal and important CSS layer precedence remain unchanged.

See [Css](README.md) for related methods and types.
