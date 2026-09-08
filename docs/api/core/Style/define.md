# Style.define

Validate named ordered styles and return immutable compiler data.

```ts
import { Style } from 'zyzz'

const styles = Style.define({ card: { padding: '1rem' } })
```

## Signature

`Style.define(styles, options?)`

## Parameters

The optional options object defaults to `{}`.

### styles

- Type: `Readonly<Record<string, Style.Properties>>` (literal keys inferred)
- Required: Yes.

Plain or null-prototype records of supported declarations. Authored ordering is preserved.

```ts
Style.define({ card: { padding: '1rem' } })
```

### options.locations

- Type: `readonly Style.SourceLocation[]`
- Default: `undefined`

Caller-owned source spans matched by complete path.

```ts
Style.define(
  { card: { padding: 0 } },
  {
    locations: [
      { end: 10, path: ['card', 'padding'], source: 'card.ts', start: 0 },
    ],
  },
)
```

### options.theme

- Type: `Theme.Definition`
- Default: `undefined`

Explicit defined theme enabling shorthand token inference. Optional themes must be narrowed before token names infer.

```ts
Style.define({ card: { padding: 'md' } }, { theme })
```

## Returns

Returns a frozen `Style.Definition`.

### styles

- Type: `readonly Style.NamedStyle[]` (names inferred)

Frozen ordered named styles and declarations. Numeric names become strings. No CSS or application props are emitted.

```ts
styles.styles[0]?.declarations
```

## Errors

`Style.InvalidError` aggregates structure, property, and value errors in traversal order. Undefined values, accessors, unsupported objects, and invalid names fail.

See [Literal Values](literals.md) for the full grammar, ordering, and diagnostic details.

See [Style](README.md) for related methods and types.
