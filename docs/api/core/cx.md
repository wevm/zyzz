# cx

> [!NOTE]
> Preview API; not yet implemented.

Compose applied generated styles while retaining their owned bindings.

```ts
import { css, cx } from 'zyzz'

const base = css({ padding: '0.5rem' })
const roomy = css({ padding: '1rem' })
const props = cx(base(), roomy())
```

## Signature

`cx(...appliedStyles)`

## Parameters

### appliedStyles

- Type: Applied style objects or `false | null | undefined` entries

Compose applied definitions. Bare class strings and unapplied definitions are invalid.

```ts
cx(base(), roomy())
```

## Returns

Returns one styling props object while preserving owned bindings and recipe attributes. Later generated conflicts win within matching conditions, subject to importance. Exact preview type names remain to be finalized.

### className

- Type: `string`

Generated class list, including supplied external classes. Class-string order does not establish CSS precedence.

```ts
props.className
```

### style

- Type: Inline style bindings and overrides

Copied inline overrides when supplied. Other component props remain on the element.

```ts
props.style
```

## Errors

Reject incompatible recipe attribute ownership and unsupported inputs. Diagnostic types remain to be finalized.
