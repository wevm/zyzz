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

### names

- Type: `readonly string[]`
- Required: Yes.

Static ordered CSS layer names, merged with other project order contributions.

```ts
Css.layers(['reset', 'base', 'components'])
```

## Returns

Contributes stylesheet order. No layer-reference object is required by the preview contract; a concrete return type remains unspecified.

## Errors

Reject invalid names and contradictory order cycles with source locations.

Bound `@layer` inference derives from config, not ambient global declarations. Normal and important CSS layer precedence remain unchanged.

See [Css](README.md) for related methods and types.
