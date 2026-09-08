# Css.siblingBefore

> [!NOTE]
> Preview API; not yet implemented.

A qualifying marked sibling preceding the styled element.

```ts
import { css } from 'zyzz'
import { Css } from 'zyzz/web'

const target = Css.marker({ state: ['closed', 'open'] })
const style = css({
  [Css.siblingBefore(target, { data: { state: 'open' } })]: { opacity: 1 },
})
```

## Signature

`Css.siblingBefore(marker, condition?)`

## Parameters

- `marker`: typed element identity.
- `condition`: supported simple pseudo or typed data/pseudo/has predicates; combined predicates match the same marked element.

## Returns

A typed condition key for a style body. Helpers add zero condition specificity; authored raw selectors keep their specificity.

## Errors

Reject undeclared marker states, unsupported nested `:has()` combinations, and unsupported native semantics.

See [Style Relationships](../../../guides/relationships.md). Ancestors match any qualifying instance, not the nearest marker boundary.

See [Css](README.md) for related methods and types.
