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

`tokens`: optional backgroundColor, borderColor, borderRadius, color, spacing, and textColor palettes. Leaves use supported literal values; color pairs require both schemes.

## Returns

`Theme.Definition<tokens>` with inferred `tokens` references and bound `css` types. References retain defining identity and property domains.

## Errors

`Theme.InvalidError` identifies invalid groups, paths, records, values, or cycles. Palettes must be nonempty and keys dot-free.

> [!NOTE]
> Source-linked `theme.css`, `theme.className`, `theme.vars`, bound `variants`, and broader groups are previews at this baseline. Use [Compile Themes](../../../guides/in-memory-themes.md) for the current executable flow.

See [Theme](README.md) for related methods and types.
