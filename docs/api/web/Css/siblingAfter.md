# Css.siblingAfter

> [!NOTE]
> Preview API; not yet implemented.

A qualifying marked sibling following the styled element.

```ts
import { css } from 'zyzz'
import { Css } from 'zyzz/web'

const target = Css.marker({ state: ['closed', 'open'] })
const style = css({
  [Css.siblingAfter(target, { data: { state: 'open' } })]: { opacity: 1 },
})
```

## Signature

`Css.siblingAfter(marker, condition?)`

## Parameters

### marker

- Type: Typed identity returned by `Css.marker`
- Required: Yes.

Element identity used to match related elements.

```ts
Css.siblingAfter(target)
```

### condition

- Type: Simple pseudo or typed data/pseudo predicates
- Default: Marker presence.

Combined predicates must match the same marked element. `has` is unsupported here because this relationship already lowers through `:has()`. Only `ancestor` and `siblingBefore` accept `has`.

```ts
Css.siblingAfter(target, { data: { state: 'open' } })
```

## Returns

### condition

- Type: Typed style condition key

Use as a computed style key. Helpers add zero condition specificity; raw authored selectors retain their specificity.

```ts
css({ [Css.siblingAfter(target, { data: { state: 'open' } })]: { opacity: 1 } })
```

## Errors

Reject undeclared marker states, unsupported nested `:has()` combinations, and unsupported native semantics.

See [Style Relationships](../../../guides/conditions.md#style-relationships).

See [Css](README.md) for related methods and types.
