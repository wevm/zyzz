# zyzz/themes/default

> [!NOTE]
> Preview API; not yet implemented.

Opt-in bundled design tokens. Core `zyzz` imports remain token-free.

```ts
import { style } from 'zyzz/themes/default'

const styles = {
  card: style({ color: 'blue.700', padding: 4 }),
}
```

| Export     | Contract                                                  |
| ---------- | --------------------------------------------------------- |
| `style`    | Bound static authoring with inferred built-in token names |
| `theme`    | Complete theme definition and references                  |
| `tokens`   | Raw token data for reuse and extension                    |
| `variants` | Bound recipe authoring                                    |

Geist colors/typography and spacing/radius scales are opt-in theme data. Use [style](../core/style.md), [Theme](../core/Theme/README.md), and [variants](../core/variants.md) for method contracts.
