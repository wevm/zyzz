# siblingBefore

A qualifying marked sibling preceding the styled element.

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

`siblingBefore(ref, state?)`

`siblingBefore(ref, pseudo, state?)`

> [!NOTE]
> The positional `pseudo` argument, a trailing `state` argument, and pseudo-class chains beyond the simple list are the accepted contract pending compiler support. The current implementation takes one `condition` argument: a simple pseudo string, or a flat state object with optional `pseudo` and `has` keys.

## Parameters

### ref

- Type: Typed identity returned by `ref`
- Required: Yes.

Element identity used to match related elements.

```ts
siblingBefore(target)
```

### pseudo

- Type: Same-element pseudo-class chain, `:${string}`
- Default: No pseudo predicate.

Pseudo-classes matched on the earlier marked sibling, including functional `:is()`, `:not()`, `:nth-child()`, and relative `:has()` lists. Compiler parsing rejects pseudo-elements, combinators outside functional arguments, `&`, selector lists, and nested `:has()`.

```ts
siblingBefore(target, ':checked')
siblingBefore(target, ':has(input:checked)')
```

### state

- Type: Declared ref states
- Default: Ref presence.

Selects declared state values on the same marked sibling, using the same object shape as applying the ref. Without a pseudo, `state` takes the second position.

```ts
siblingBefore(target, { state: 'open' })
siblingBefore(target, ':checked', { state: 'open' })
```

## Returns

### condition

- Type: Typed style condition key

Use as a computed style key. Helpers add zero condition specificity; raw authored selectors retain their specificity. Nested relationship keys combine with AND.

```ts
css({
  [siblingBefore(target, { state: 'open' })]: { opacity: 1 },
})
```

## Errors

Reject undeclared ref states, unknown or malformed pseudo-classes, nested `:has()`, and unsupported native semantics.

See [Style Relationships](../../guides/conditions.md#style-relationships).

See [Web](README.md) for related methods and types.

Requires the source transform. Marker identities survive aliases, named re-exports, and packed-library contracts. Relationship helpers must appear directly as computed style keys. Browser rendering follows ordinary CSS matching, including any-depth ancestry and directional nonadjacent siblings.
