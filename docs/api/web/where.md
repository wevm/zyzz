# where

Compose a relationship condition from typed refs and ordinary CSS selector text.

```ts
import { css } from 'zyzz'
import { ref, where } from 'zyzz/web'

const card = ref({ state: ['closed', 'open'] })
namespace styles {
  export const label = css({
    [where`${card({ state: 'open' })} &`]: { opacity: 1 },
  })
}
```

Refs interpolate as compiler-owned attribute selectors. The compiler wraps each compound containing a ref in `:where()`, so ref predicates add zero specificity while `&` keeps its generated class specificity. A trailing pseudo-element stays outside the wrapper.

```css
:where([data-z-card][data-z-card-state='open']) & {
  opacity: 1;
}
```

Combinators express direction and distance; nothing else is needed.

| Relationship                            | Key                                                  |
| --------------------------------------- | ---------------------------------------------------- |
| Ancestor in a state                     | `` where`${card({ state: 'open' })} &` ``            |
| Hovered ancestor                        | `` where`${card}:hover &` ``                         |
| Parent                                  | `` where`${card} > &` ``                             |
| Checked descendant                      | `` where`&:has(${choice}:checked)` ``                |
| Earlier sibling                         | `` where`${choice}:checked ~ &` ``                   |
| Later sibling                           | `` where`&:has(~ ${choice}:checked)` ``              |
| Either sibling                          | `` where`${choice} ~ &, &:has(~ ${choice})` ``       |
| Anywhere in the document                | `` where`:root:has(${card({ state: 'open' })}) &` `` |
| Ancestor containing a marked descendant | `` where`${card}:has(${choice}:checked) &` ``        |

## Signature

`` where`selector` ``

## Parameters

### selector

- Type: Tagged template of scoped selector text with ref interpolations
- Required: Yes.

Text follows raw condition key rules: `&` names the styled element, a leading pseudo-class implies `&`, and every selector in a list names `&`. Interpolations accept a ref handle for presence, or a ref application such as `card({ state: 'open' })`, written inline or bound to a `const`, for presence plus declared states. Other interpolations are type errors. Negate a state while keeping presence: `${card}:not(${card({ state: 'open' })}) &`.

```ts
where`${card}:focus-within &`
```

## Returns

### condition

- Type: Typed style condition key

Use as a computed style key inside web `css` definitions. Nested keys combine with AND. Core `Style.define` and `global` reject relationship keys.

```ts
css({ [where`${card} &`]: { opacity: 1 } })
```

## Errors

Reject non-ref interpolations, interpolations inside quoted or bracketed text, undeclared states, invalid selector grammar, unknown pseudo-classes, selectors that neither contain `&` nor start with a pseudo-class, nested `:has()`, and `:visited` inside `:has()`, which never matches in browsers.

See [Style Relationships](../../guides/conditions.md#style-relationships). Repeated refs match any qualifying instance, not the nearest boundary.

See [Web](README.md) for related methods and types.

Requires the source transform. Marker identities survive aliases, named re-exports, and packed-library contracts. `where` must appear directly as a computed style key. Browser rendering follows ordinary CSS matching.
