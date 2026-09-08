# Theme.define

Define immutable scalar tokens and portable references.

```ts
import { Theme } from 'zyzz'

const theme = Theme.define({
  color: { text: { dark: '#eee', light: '#111' } },
  spacing: { md: '1rem' },
})
```

## Signature

`Theme.define(tokens)`

## Parameters

### tokens

- Type: `Theme.Tokens` (literal paths inferred)
- Required: Yes.

Token palettes. Palettes must be nonempty data records with dot-free keys.

```ts
Theme.define({ spacing: { md: '1rem' } })
```

### tokens.backgroundColor

- Type: `Theme.Tokens["backgroundColor"]`
- Default: `undefined`

Background color palette. Leaves use the supported literal grammar; nested palettes infer dotted paths. Color pairs require both schemes.

```ts
Theme.define({ backgroundColor: { brand: '#06c' } })
```

### tokens.borderColor

- Type: `Theme.Tokens["borderColor"]`
- Default: `undefined`

Border color palette. Leaves use the supported literal grammar; nested palettes infer dotted paths. Color pairs require both schemes.

```ts
Theme.define({ borderColor: { subtle: '#eee' } })
```

### tokens.borderRadius

- Type: `Theme.Tokens["borderRadius"]`
- Default: `undefined`

Border radius palette. Leaves use the supported literal grammar; nested palettes infer dotted paths. Color pairs require both schemes.

```ts
Theme.define({ borderRadius: { rounded: '0.5rem' } })
```

### tokens.color

- Type: `Theme.Tokens["color"]`
- Default: `undefined`

Shared color palette. Leaves use the supported literal grammar; nested palettes infer dotted paths. Color pairs require both schemes.

```ts
Theme.define({ color: { text: { dark: '#eee', light: '#111' } } })
```

### tokens.spacing

- Type: `Theme.Tokens["spacing"]`
- Default: `undefined`

Spacing and sizing palette. Leaves use the supported literal grammar; nested palettes infer dotted paths. Color pairs require both schemes.

```ts
Theme.define({ spacing: { md: '1rem' } })
```

### tokens.textColor

- Type: `Theme.Tokens["textColor"]`
- Default: `undefined`

Text color palette. Leaves use the supported literal grammar; nested palettes infer dotted paths. Color pairs require both schemes.

```ts
Theme.define({ textColor: { muted: '#666' } })
```

## Returns

Returns `Theme.Definition<tokens>` with inferred references and bound authoring types.

### css

- Type: `Theme.Css<tokens>`

Bound callable authoring with inferred token names. Source linking is a preview at this baseline; untransformed execution throws `css.MissingTransformError`.

```ts
const card = theme.css({ padding: 'md' })
```

### tokens

- Type: `Theme.References<tokens>`

Immutable references retaining defining identity and property domains. These references work in the in-memory compiler.

```ts
theme.tokens.spacing.md
```

## Errors

`Theme.InvalidError` identifies invalid groups, paths, records, values, or cycles. Palettes must be nonempty and keys dot-free.

> [!NOTE]
> Source-linked `theme.css`, `theme.className`, `theme.vars`, bound `variants`, and broader groups are previews at this baseline. Use [Compile Themes](../../../guides/themes.md#compile-themes) for the current executable flow.

See [Theme](README.md) for related methods and types.
