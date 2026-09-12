# ancestor

A qualifying ancestor at any depth.

```ts
import { css } from 'zyzz'
import { ancestor, marker } from 'zyzz/web'

const target = marker({ state: ['closed', 'open'] })
namespace styles {
  export const targetStyle = css({
    [ancestor(target, { data: { state: 'open' } })]: { opacity: 1 },
  })
}
```

## Signature

`ancestor(marker, condition?)`

## Parameters

### marker

- Type: Typed identity returned by `marker`
- Required: Yes.

Element identity used to match related elements.

```ts
ancestor(target)
```

### condition

- Type: Simple pseudo or typed data/pseudo/has predicates
- Default: Marker presence.

Combined predicates must match the same marked element.

```ts
ancestor(target, { data: { state: 'open' } })
```

## Returns

### condition

- Type: Typed style condition key

Use as a computed style key. Helpers add zero condition specificity; raw authored selectors retain their specificity.

```ts
css({ [ancestor(target, { data: { state: 'open' } })]: { opacity: 1 } })
```

## Errors

Reject undeclared marker states, unsupported nested `:has()` combinations, and unsupported native semantics.

See [Style Relationships](../../guides/conditions.md#style-relationships). Ancestors match any qualifying instance, not the nearest marker boundary.

See [Web](README.md) for related methods and types.

Requires the source transform. Marker identities survive aliases, named re-exports, and packed-library contracts. Relationship helpers must appear directly as computed style keys. Browser rendering follows ordinary CSS matching, including any-depth ancestry and directional nonadjacent siblings.
