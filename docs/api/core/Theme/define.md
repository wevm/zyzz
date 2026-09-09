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

Current color leaves accept 3/4/6/8-digit hex, `black`, `white`, `transparent`, or `currentColor`, optionally paired as `{ dark, light }`. Other named or functional colors are unsupported. Spacing and radius leaves accept nonnegative literal lengths or zero, without scheme pairs.

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

Border color palette for whole borders and physical/logical sides, preferred over shared colors. Leaves use the supported literal grammar; nested palettes infer dotted paths. Color pairs require both schemes.

```ts
Theme.define({ borderColor: { subtle: '#eee' } })
```

### tokens.borderRadius

- Type: `Theme.Tokens["borderRadius"]`
- Default: `undefined`

Border radius palette for whole borders and physical/logical corners. Leaves are nonnegative literal lengths, percentages, or zero; nested palettes infer dotted paths. Light/dark pairs are unsupported.

```ts
Theme.define({ borderRadius: { rounded: '0.5rem' } })
```

### tokens.color

- Type: `Theme.Tokens["color"]`
- Default: `undefined`

Shared color palette for text, backgrounds, borders, and outlines. Leaves use the supported literal grammar; nested palettes infer dotted paths. Color pairs require both schemes.

```ts
Theme.define({ color: { text: { dark: '#eee', light: '#111' } } })
```

### tokens.spacing

- Type: `Theme.Tokens["spacing"]`
- Default: `undefined`

Spacing and sizing palette. Leaves are nonnegative literal lengths or zero; nested palettes infer dotted paths. Light/dark pairs are unsupported.

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

Returns a callable `Theme.Definition<tokens>` with inferred references and bound authoring types. [Theme application](apply.md) returns scope props with an optional `colorScheme`.

### className

- Type: `string`

Scope class replaced by the source compiler for a local theme. Reading it without transformation throws the missing-transform error.

```ts
const scope = theme.className
```

### css

- Type: `Theme.Css<tokens>`

Bound callable authoring with inferred token names. Same-module source compilation is supported; untransformed execution throws an error named `css.MissingTransformError`. In-memory token resolution uses `Style.define(styles, { theme })`, then `Css.compile`.

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
> Same-module `theme.css` and `theme.className` are supported by `Transform.compile`. Cross-module linking, `theme.vars`, bound `variants`, and broader groups remain previews. See [Compile Local Theme Source](../../../guides/themes.md#compile-local-theme-source).

See [Theme](README.md) for related methods and types.
