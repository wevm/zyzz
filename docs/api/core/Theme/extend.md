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

### theme

- Type: `Theme.Definition<tokens>`
- Required: Yes.

Existing definition supplying the contract and untouched token values.

```ts
Theme.extend(base, { spacing: { md: '2rem' } })
```

### overrides

- Type: `Theme.Overrides<tokens>`
- Required: Yes.

Partial existing paths with compatible values. Color pairs replace the whole leaf.

```ts
Theme.extend(base, { spacing: { md: '2rem' } })
```

## Returns

Returns a complete immutable `Theme.Definition<tokens>` preserving the original contract identity and untouched values.

### className

- Type: `string`

Scope class replaced by the source compiler for a local theme. Reading it without transformation throws the missing-transform error.

```ts
const scope = theme.className
```

### style

- Type: `Theme.StyleFactory<tokens>`

Bound callable authoring with inferred token names. Same-module source compilation is supported; untransformed execution throws an error named `style.MissingTransformError`. In-memory token resolution uses `Style.define(styles, { theme })`, then `Css.compile`.

```ts
namespace styles {
  export const card = roomy.style({ padding: 'md' })
}
```

### tokens

- Type: `Theme.References<tokens>`

Immutable references retaining defining identity and property domains. These references work in the in-memory compiler.

```ts
roomy.tokens.spacing.md
```

## Errors

`Theme.InvalidError` rejects unknown paths, incompatible values, or malformed override records.

See [Theme](README.md) for related methods and types.
