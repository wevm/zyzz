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

Current color leaves accept 3/4/6/8-digit hex, the 148 canonical lowercase CSS named colors, 19 canonical system-color keywords, `transparent`, or `currentColor`, optionally paired as `{ dark, light }`. CSS color literals are statically checked. Spacing and radius leaves accept nonnegative literal lengths or zero, without scheme pairs.

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

### tokens.breakpoints

- Type: `Theme.Tokens["breakpoints"]`
- Default: `undefined`

Named nonnegative fixed length thresholds for media width queries; metadata is not emitted as custom properties.

```ts
Theme.define({ breakpoints: { tablet: '48rem' } })
```

### tokens.containers

- Type: `Theme.Tokens["containers"]`
- Default: `undefined`

Named nonnegative fixed length thresholds for container width queries; metadata is separate from declaration tokens.

```ts
Theme.define({ containers: { card: '24rem' } })
```

### tokens.containerNames

- Type: `Theme.Tokens["containerNames"]`
- Default: `undefined`

Unique container identifiers eligible for named queries. Reserved names such as none and CSS-wide keywords are rejected.

```ts
Theme.define({ containerNames: ['sidebar'] })
```

### tokens.fontFamily

- Type: `Theme.Tokens["fontFamily"]`
- Default: `undefined`

Scalar font-family palettes, without light/dark pairs or CSS-wide keywords.

```ts
Theme.define({ fontFamily: { body: 'system-ui, sans-serif' } })
```

### tokens.fontSize

- Type: `Theme.Tokens["fontSize"]`
- Default: `undefined`

Scalar font-size palettes; values retain their property domain and do not accept scheme pairs.

```ts
Theme.define({ fontSize: { body: '1rem' } })
```

### tokens.fontWeight

- Type: `Theme.Tokens["fontWeight"]`
- Default: `undefined`

Scalar numeric font weights from 1 through 1000, without scheme pairs.

```ts
Theme.define({ fontWeight: { medium: 500 } })
```

### tokens.lineHeight

- Type: `Theme.Tokens["lineHeight"]`
- Default: `undefined`

Scalar line-height palettes, supporting nonnegative numbers and lengths.

```ts
Theme.define({ lineHeight: { relaxed: 1.5 } })
```

### tokens.letterSpacing

- Type: `Theme.Tokens["letterSpacing"]`
- Default: `undefined`

Scalar letter-spacing palettes, including signed lengths.

```ts
Theme.define({ letterSpacing: { tight: '-0.02em' } })
```

### tokens.margin

- Type: Optional nested records of signed CSS lengths or zero
- Default: Falls back to `spacing` when omitted.

Applies to physical and logical margin properties before the shared spacing scale. Negative lengths are supported.

```ts
const theme = Theme.define({ spacing: { sm: '4px' }, margin: { sm: '-8px' } })
const style = theme.css({ marginInlineStart: 'sm' })
```

### tokens.padding

- Type: Optional nested records of nonnegative CSS lengths or zero
- Default: Falls back to `spacing` when omitted.

Applies to physical and logical padding properties before the shared spacing scale. Static authoring rejects negative padding tokens.

```ts
const theme = Theme.define({ spacing: { sm: '4px' }, padding: { sm: '8px' } })
const style = theme.css({ paddingInline: 'sm' })
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
const styles = {
  card: theme.css({ padding: 'md' }),
}
```

### tokens

- Type: `Theme.References<tokens>`

Immutable references retaining defining identity and property domains. These references work in the in-memory compiler.

```ts
theme.tokens.spacing.md
```

## Errors

`Theme.InvalidError` identifies invalid groups, paths, records, or cycles. Palettes must be nonempty and keys dot-free. CSS token values are checked statically.

> [!NOTE]
> Same-module `theme.css` and `theme.className` are supported by `Transform.compile`. Graph compilation supports cross-module linking and `theme.vars` references. Bound `variants` remains a preview. See [Compile Local Theme Source](../../../guides/themes.md#compile-local-theme-source).

See [Theme](README.md) for related methods and types.
