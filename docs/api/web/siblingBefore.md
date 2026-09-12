# siblingBefore

A qualifying marked sibling preceding the styled element.

> [!NOTE]
> Superseded by [where](where.md), which writes this relationship as `` where`${target} ~ &` `` and is pending compiler support. This helper remains exported until `where` lands.

```ts
import { css } from 'zyzz'
import { ref, siblingBefore } from 'zyzz/web'

const target = ref({ state: ['closed', 'open'] })
namespace styles {
  export const targetStyle = css({
    [siblingBefore(target, { state: 'open' })]: { opacity: 1 },
  })
}
```

## Signature

`siblingBefore(ref, condition?)`

## Parameters

### ref

- Type: Typed identity returned by `ref`
- Required: Yes.

Element identity used to match related elements.

```ts
siblingBefore(target)
```

### condition

- Type: Simple pseudo or flattened typed states with optional `pseudo`/`has` predicates
- Default: Ref presence.

Combined predicates must match the same marked element.

```ts
siblingBefore(target, { state: 'open' })
```

## Returns

### condition

- Type: Typed style condition key

Use as a computed style key. Helpers add zero condition specificity; raw authored selectors retain their specificity.

```ts
css({
  [siblingBefore(target, { state: 'open' })]: { opacity: 1 },
})
```

## Errors

Reject undeclared ref states, unsupported nested `:has()` combinations, and unsupported native semantics.

See [Style Relationships](../../guides/conditions.md#style-relationships).

See [Web](README.md) for related methods and types.

Requires the source transform. Marker identities survive aliases, named re-exports, and packed-library contracts. Relationship helpers must appear directly as computed style keys. Browser rendering follows ordinary CSS matching, including any-depth ancestry and directional nonadjacent siblings.
