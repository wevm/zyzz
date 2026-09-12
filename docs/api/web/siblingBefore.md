# siblingBefore

A qualifying marked sibling preceding the styled element.

```ts
import { css } from 'zyzz'
import { marker, siblingBefore } from 'zyzz/web'

const target = marker({ state: ['closed', 'open'] })
namespace styles {
  export const targetStyle = css({
    [siblingBefore(target, { data: { state: 'open' } })]: { opacity: 1 },
  })
}
```

## Signature

`siblingBefore(marker, condition?)`

## Parameters

### marker

- Type: Typed identity returned by `marker`
- Required: Yes.

Element identity used to match related elements.

```ts
siblingBefore(target)
```

### condition

- Type: Simple pseudo or typed data/pseudo/has predicates
- Default: Marker presence.

Combined predicates must match the same marked element.

```ts
siblingBefore(target, { data: { state: 'open' } })
```

## Returns

### condition

- Type: Typed style condition key

Use as a computed style key. Helpers add zero condition specificity; raw authored selectors retain their specificity.

```ts
css({
  [siblingBefore(target, { data: { state: 'open' } })]: { opacity: 1 },
})
```

## Errors

Reject undeclared marker states, unsupported nested `:has()` combinations, and unsupported native semantics.

See [Style Relationships](../../guides/conditions.md#style-relationships).

See [Web](README.md) for related methods and types.

Requires the source transform. Marker identities survive aliases, named re-exports, and packed-library contracts. Relationship helpers must appear directly as computed style keys. Browser rendering follows ordinary CSS matching, including any-depth ancestry and directional nonadjacent siblings.
