# Themes and Tokens

A theme defines named values and their property domains. It contains token data, without a name or scheme metadata wrapper.

```ts
import { Theme } from 'zyzz'

const theme = Theme.define({
  color: { brand: { dark: '#8cf', light: '#06c' } },
  spacing: { md: '1rem' },
})
```

- **Contracts:** explicit references preserve their defining identity and domain.
- **Extensions:** change existing paths while retaining compatibility.
- **Names:** property-specific groups infer only where their domain is valid.
- **Schemes:** color leaves accept one shared string or a complete light/dark pair.

Use [Compile Themes](../guides/in-memory-themes.md) for the current pipeline.

> [!NOTE]
> Config normalization, bundled defaults, typography/query groups, and web expression references are previews. Config returns compatible handles without mutating independently defined themes.
