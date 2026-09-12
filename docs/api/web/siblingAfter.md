# siblingAfter

A qualifying marked sibling following the styled element.

> [!NOTE]
> Superseded by [where](where.md), which writes this relationship as `` where`&:has(~ ${target})` `` and is pending compiler support. This helper remains exported until `where` lands.

```ts
import { css } from 'zyzz'
import { ref, siblingAfter } from 'zyzz/web'

const target = ref({ state: ['closed', 'open'] })
namespace styles {
  export const targetStyle = css({
    [siblingAfter(target, { state: 'open' })]: { opacity: 1 },
  })
}
```

## Signature

`siblingAfter(ref, condition?)`

## Parameters

### ref

- Type: Typed identity returned by `ref`
- Required: Yes.

Element identity used to match related elements.

```ts
siblingAfter(target)
```

### condition

- Type: Simple pseudo or typed data/pseudo predicates
- Default: Ref presence.

Combined predicates must match the same marked element. `has` is unsupported here because this relationship already lowers through `:has()`. Only `ancestor` and `siblingBefore` accept `has`.

```ts
siblingAfter(target, { state: 'open' })
```

## Returns

### condition

- Type: Typed style condition key

Use as a computed style key. Helpers add zero condition specificity; raw authored selectors retain their specificity.

```ts
css({ [siblingAfter(target, { state: 'open' })]: { opacity: 1 } })
```

## Errors

Reject undeclared ref states, unsupported nested `:has()` combinations, and unsupported native semantics.

See [Style Relationships](../../guides/conditions.md#style-relationships).

See [Web](README.md) for related methods and types.

Requires the source transform. Marker identities survive aliases, named re-exports, and packed-library contracts. Relationship helpers must appear directly as computed style keys. Browser rendering follows ordinary CSS matching, including any-depth ancestry and directional nonadjacent siblings.
