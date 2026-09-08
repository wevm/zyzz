# Css.marker

> [!NOTE]
> Preview API; not yet implemented.

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

Reject invalid schemas and undeclared state values. Markers do not validate the DOM tree or supply ARIA attributes.

See [Css](README.md) for related methods and types.
