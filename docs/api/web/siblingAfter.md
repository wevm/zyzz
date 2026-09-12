# siblingAfter

A qualifying marked sibling following the styled element.

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

`siblingAfter(ref, state?)`

`siblingAfter(ref, pseudo, state?)`

> [!NOTE]
> The positional `pseudo` argument, a trailing `state` argument, and pseudo-class chains beyond the simple list are the accepted contract pending compiler support. The current implementation takes one `condition` argument: a simple pseudo string, or a flat state object with an optional `pseudo` key.

## Parameters

### ref

- Type: Typed identity returned by `ref`
- Required: Yes.

Element identity used to match related elements.

```ts
siblingAfter(target)
```

### pseudo

- Type: Same-element pseudo-class chain, `:${string}`
- Default: No pseudo predicate.

Pseudo-classes matched on the later marked sibling, including functional `:is()`, `:not()`, and `:nth-child()`. This relationship already lowers through `:has()`, so `:has()` and `:visited` are rejected here; only `ancestor` and `siblingBefore` accept them. Compiler parsing also rejects pseudo-elements, combinators outside functional arguments, `&`, and selector lists.

```ts
siblingAfter(target, ':checked')
```

### state

- Type: Declared ref states
- Default: Ref presence.

Selects declared state values on the same marked sibling, using the same object shape as applying the ref. Without a pseudo, `state` takes the second position.

```ts
siblingAfter(target, { state: 'open' })
siblingAfter(target, ':checked', { state: 'open' })
```

## Returns

### condition

- Type: Typed style condition key

Use as a computed style key. Helpers add zero condition specificity; raw authored selectors retain their specificity. Nested relationship keys combine with AND.

```ts
css({ [siblingAfter(target, { state: 'open' })]: { opacity: 1 } })
```

## Errors

Reject undeclared ref states, unknown or malformed pseudo-classes, `:has()` and `:visited` predicates, and unsupported native semantics.

See [Style Relationships](../../guides/conditions.md#style-relationships).

See [Web](README.md) for related methods and types.

Requires the source transform. Marker identities survive aliases, named re-exports, and packed-library contracts. Relationship helpers must appear directly as computed style keys. Browser rendering follows ordinary CSS matching, including any-depth ancestry and directional nonadjacent siblings.
