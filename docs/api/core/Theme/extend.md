# Theme.extend

Create compatible token overrides without changing the base definition.

```ts
import { Theme } from 'zyzz'

const base = Theme.define({ spacing: { md: '1rem' } })
const roomy = Theme.extend(base, { spacing: { md: '2rem' } })
```

## Signature

`Theme.extend(theme, overrides)`

## Parameters

- `theme`: an existing definition.
- `overrides`: partial existing paths with compatible values; color pairs replace the whole leaf.

## Returns

A complete immutable theme preserving the original contract identity and untouched token values.

## Errors

`Theme.InvalidError` rejects unknown paths, incompatible values, or malformed override records.

See [Theme](README.md) for related methods and types.
