# Css.anySibling

A qualifying sibling in either direction.

```ts
import { css } from 'zyzz'
import { Css } from 'zyzz/web'

const target = Css.marker({ state: ['closed', 'open'] })
namespace styles {
  export const targetStyle = css({
    [Css.anySibling(target, { data: { state: 'open' } })]: { opacity: 1 },
  })
}
```

## Signature

`Css.anySibling(marker, condition?)`

## Parameters

### marker

- Type: Typed identity returned by `Css.marker`
- Required: Yes.

Element identity used to match related elements.

```ts
Css.anySibling(target)
```

### condition

- Type: Simple pseudo or typed data/pseudo predicates
- Default: Marker presence.

Combined predicates must match the same marked element. `has` is unsupported here because this relationship already lowers through `:has()`. Only `ancestor` and `siblingBefore` accept `has`.

```ts
Css.anySibling(target, { data: { state: 'open' } })
```

## Returns

### condition

- Type: Typed style condition key

Use as a computed style key. Helpers add zero condition specificity; raw authored selectors retain their specificity.

```ts
css({ [Css.anySibling(target, { data: { state: 'open' } })]: { opacity: 1 } })
```

## Errors

Reject undeclared marker states, unsupported nested `:has()` combinations, and unsupported native semantics.

See [Style Relationships](../../../guides/conditions.md#style-relationships).

See [Css](README.md) for related methods and types.

Requires the source transform. Marker identities survive aliases, named re-exports, and packed-library contracts. Relationship helpers must appear directly as computed style keys. Browser rendering follows ordinary CSS matching, including any-depth ancestry and directional nonadjacent siblings.
