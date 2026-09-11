# Css.marker

Define a typed identity and finite data states for element relationships.

```ts
import { Css } from 'zyzz/web'

const card = Css.marker({ state: ['closed', 'open'] })
const attributes = card({ state: 'open' })
```

## Signature

`Css.marker(schema?)`

## Parameters

### schema

- Type: Named finite state domains
- Default: Presence marker without state domains.

Applications may select only declared state values.

```ts
Css.marker({ state: ['closed', 'open'] })
```

## Returns

### marker

- Type: Typed callable marker identity

Produces owned attributes when applied. Imported identity survives package boundaries. This does not validate DOM structure or supply ARIA attributes.

```ts
const attributes = card({ state: 'open' })
```

## Errors

Reject invalid schemas, state keys colliding after ASCII case folding, and undeclared state values. Attribute names and selectors use the same lowercase key fragments; typed selections remain case-sensitive. Markers do not validate the DOM tree or supply ARIA attributes.

See [Css](README.md) for related methods and types.

Requires the source transform. Marker identities survive aliases, named re-exports, and packed-library contracts. Relationship helpers must appear directly as computed style keys. Browser rendering follows ordinary CSS matching, including any-depth ancestry and directional nonadjacent siblings.
