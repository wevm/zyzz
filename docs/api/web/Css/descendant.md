# Css.descendant

A qualifying descendant at any depth.

```ts
import { style } from 'zyzz'
import { Css } from 'zyzz/web'

const target = Css.marker({ state: ['closed', 'open'] })
const style = style({
  [Css.descendant(target, { data: { state: 'open' } })]: { opacity: 1 },
})
```

Preview API; not yet implemented.

## Signature

`Css.descendant(marker, condition?)`

## Parameters

### marker

- Type: Typed identity returned by `Css.marker`
- Required: Yes.

Element identity used to match related elements.

```ts
Css.descendant(target)
```

### condition

- Type: Simple pseudo or typed data/pseudo predicates
- Default: Marker presence.

Combined predicates must match the same marked element. `has` is unsupported here because this relationship already lowers through `:has()`. Only `ancestor` and `siblingBefore` accept `has`.

```ts
Css.descendant(target, { data: { state: 'open' } })
```

## Returns

### condition

- Type: Typed style condition key

Use as a computed style key. Helpers add zero condition specificity; raw authored selectors retain their specificity.

```ts
style({ [Css.descendant(target, { data: { state: 'open' } })]: { opacity: 1 } })
```

## Errors

Reject undeclared marker states, unsupported nested `:has()` combinations, and unsupported native semantics.

See [Style Relationships](../../../guides/conditions.md#style-relationships).

See [Css](README.md) for related methods and types.
