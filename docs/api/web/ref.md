# ref

Define a typed identity and finite data states for element relationships.

```ts
import { ref } from 'zyzz/web'

const card = ref({ state: ['closed', 'open'] })
const attributes = card({ state: 'open' })
```

Apply the ref to the related element and interpolate the same identity into a `where` condition. The compiler assigns a unique attribute; no class name or hand-written attribute selector is needed.

> [!NOTE]
> `where` is pending compiler support. Current builds select refs through the direction helpers, such as `ancestor(card, { state: 'open' })`.

```tsx
import { css } from 'zyzz'
import { ref, where } from 'zyzz/web'

const card = ref({ state: ['closed', 'open'] })

namespace styles {
  export const label = css({
    [where`${card({ state: 'open' })} &`]: { color: 'blue' },
  })
}

export function Card({ open }: { open: boolean }) {
  return (
    <section {...card({ state: open ? 'open' : 'closed' })}>
      <span {...styles.label()}>Details</span>
    </section>
  )
}
```

For presence alone, use `const card = ref()`, apply `card()`, and interpolate `${card}`. State attributes are scoped to the ref identity; semantic attributes such as `aria-expanded` stay on the element that owns them.

## Signature

`ref(schema?)`

## Parameters

### schema

- Type: Named finite state domains
- Default: Presence ref without state domains.

Applications and relationship conditions may select only declared state values. The same call applies the ref in JSX and, interpolated into `where`, narrows a relationship. State names become data-attribute fragments; `class`, `className`, `style`, `key`, and `ref` are reserved.

> [!NOTE]
> The current implementation also reserves `pseudo` and `has`, which configure predicates in the direction helpers. `where` frees both names.

```ts
ref({ state: ['closed', 'open'] })
```

## Returns

### ref

- Type: Typed callable ref identity

Produces owned attributes when applied. Imported identity survives package boundaries. This does not validate DOM structure or supply ARIA attributes.

```ts
const attributes = card({ state: 'open' })
```

## Errors

Reject invalid schemas, state keys colliding after ASCII case folding, and undeclared state values. Attribute names and selectors use the same lowercase key fragments; typed selections remain case-sensitive. Markers do not validate the DOM tree or supply ARIA attributes.

See [Web](README.md) for related methods and types.

Requires the source transform. Marker identities survive aliases, named re-exports, and packed-library contracts. Relationship helpers must appear directly as computed style keys. Browser rendering follows ordinary CSS matching, including any-depth ancestry and directional nonadjacent siblings.
