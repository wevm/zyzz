# Css.siblingBefore

A qualifying marked sibling preceding the styled element.

```ts
import { style } from 'zyzz'
import { Css } from 'zyzz/web'

const target = Css.marker({ state: ['closed', 'open'] })
const style = style({
  [Css.siblingBefore(target, { data: { state: 'open' } })]: { opacity: 1 },
})
```

Preview API; not yet implemented.

## Signature

`Css.siblingBefore(marker, condition?)`

## Parameters

### marker

- Type: Typed identity returned by `Css.marker`
- Required: Yes.

Element identity used to match related elements.

```ts
Css.siblingBefore(target)
```

### condition

- Type: Simple pseudo or typed data/pseudo/has predicates
- Default: Marker presence.

Combined predicates must match the same marked element.

```ts
Css.siblingBefore(target, { data: { state: 'open' } })
```

## Returns

### condition

- Type: Typed style condition key

Use as a computed style key. Helpers add zero condition specificity; raw authored selectors retain their specificity.

```ts
style({
  [Css.siblingBefore(target, { data: { state: 'open' } })]: { opacity: 1 },
})
```

## Errors

Reject undeclared marker states, unsupported nested `:has()` combinations, and unsupported native semantics.

See [Style Relationships](../../../guides/conditions.md#style-relationships).

See [Css](README.md) for related methods and types.
