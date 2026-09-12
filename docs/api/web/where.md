# where

Compose a relationship condition from css definitions and ordinary CSS selector text.

```ts
import { css } from 'zyzz'
import { where } from 'zyzz/web'

namespace styles {
  export const card = css({ padding: 16 })
  export const label = css({
    [where`${card}[aria-expanded="true"] &`]: { opacity: 1 },
  })
}
```

Every `css` definition carries one identity class, so the element it styles is addressable without extra markup. Interpolating a definition lowers to that class. The compiler wraps each compound containing a definition in `:where()`, so definition predicates add zero specificity while `&` keeps its generated class specificity. A trailing pseudo-element stays outside the wrapper.

```css
:where(.z-card[aria-expanded='true']) & {
  opacity: 1;
}
```

State is ordinary selector text: real attributes such as `aria-expanded`, `open`, or `:checked`, or application-owned `data-*` attributes. Combinators express direction and distance.

| Relationship                            | Key                                            |
| --------------------------------------- | ---------------------------------------------- |
| Ancestor in a state                     | `` where`${card}[aria-expanded="true"] &` ``   |
| Hovered ancestor                        | `` where`${card}:hover &` ``                   |
| Parent                                  | `` where`${card} > &` ``                       |
| Checked descendant                      | `` where`&:has(${toggle}:checked)` ``          |
| Earlier sibling                         | `` where`${toggle}:checked ~ &` ``             |
| Later sibling                           | `` where`&:has(~ ${toggle}:checked)` ``        |
| Either sibling                          | `` where`${toggle} ~ &, &:has(~ ${toggle})` `` |
| Anywhere in the document                | `` where`:root:has(${dialog}[open]) &` ``      |
| Ancestor containing a styled descendant | `` where`${card}:has(${toggle}:checked) &` ``  |

An element that needs identity without declarations uses an empty definition, `css({})`, which compiles to its identity class alone.

## Signature

`` where`selector` ``

## Parameters

### selector

- Type: Tagged template of scoped selector text with css definition interpolations
- Required: Yes.

Text follows raw condition key rules: `&` names the styled element, a leading pseudo-class implies `&`, and every selector in a list names `&`. Interpolations are module-level `css` definitions: direct constants, `namespace` members, object members, or definitions imported from a packed library. Applied props, strings, and other values are type errors. Negate a state while keeping identity: `${card}:not([aria-expanded="true"]) &`.

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

Reject interpolations that are not compiled css definitions, interpolations inside quoted or bracketed text, invalid selector grammar, unknown pseudo-classes, selectors that neither contain `&` nor start with a pseudo-class, nested `:has()`, and `:visited` inside `:has()`, which never matches in browsers.

See [Style Relationships](../../guides/conditions.md#style-relationships). Repeated applications of one definition match any qualifying instance, not the nearest boundary.

See [Web](README.md) for related methods and types.

Requires the source transform. Definition identities survive aliases, named re-exports, and packed-library contracts. `where` must appear directly as a computed style key. Browser rendering follows ordinary CSS matching.
