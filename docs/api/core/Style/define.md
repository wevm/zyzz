# Style.define

Validate named ordered styles and return immutable compiler data.

```ts
import { Style } from 'zyzz'

const styles = Style.define({ card: { padding: '1rem' } })
```

## Signature

`Style.define(styles, options?)`

## Parameters

- `styles`: plain or null-prototype records of supported declarations.
- `options.locations`: optional caller-owned source spans matched by complete path.
- `options.theme`: explicit theme enabling shorthand token inference.

## Returns

A frozen `Style.Definition` containing ordered named styles and declarations. Names retain inference, including numeric keys as strings. No CSS or application props are emitted.

## Errors

`Style.InvalidError` aggregates structure, property, and value errors in traversal order. Undefined values, accessors, unsupported objects, and invalid names fail.

See [Literal Values](literals.md) for the full grammar, ordering, and diagnostic details.

See [Style](README.md) for related methods and types.
