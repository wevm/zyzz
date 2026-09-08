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

Applied style objects or conditional false/null/undefined entries. Bare class strings and unapplied definitions are invalid.

## Returns

One styling props object. Later conflicting generated declarations win in matching conditions, subject to CSS importance.

## Errors

Reject incompatible recipe attribute ownership and unsupported inputs. Diagnostic types remain to be finalized.
