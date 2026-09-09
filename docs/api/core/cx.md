# cx

Compose applied generated styles while retaining their owned bindings.

```ts
import { style, cx } from 'zyzz'

const base = style({ padding: '0.5rem' })

const roomy = style({ padding: '1rem' })
const selected = cx(base, roomy)
```

Preview API; not yet implemented.

## Signature

`cx(...appliedStyles)`

## Parameters

### appliedStyles

- Type: Style values or `false | null | undefined` entries

Compose static style values or the results of dynamic and variant calls. Bare class strings are invalid.

```ts
cx(styles.base, styles.roomy)
```

## Returns

One opaque value for the `style` prop, preserving bindings and recipe attributes. Later generated conflicts win within matching conditions, subject to importance. Exact preview types remain to be finalized.

```tsx
const example = <button style={cx(styles.base, styles.roomy)} />
```

## Errors

Reject incompatible recipe attribute ownership and unsupported inputs. Diagnostic types remain to be finalized.
