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

Optional state domains. Omitting the schema creates a presence marker; applications select declared states.

## Returns

A marker identity with a callable producing owned attributes. Imported identity survives package boundaries.

## Errors

Reject invalid schemas and undeclared state values. Markers do not validate the DOM tree or supply ARIA attributes.

See [Css](README.md) for related methods and types.
