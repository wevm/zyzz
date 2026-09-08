# zyzz/themes/default

> [!NOTE]
> Preview API; not yet implemented.

Opt-in bundled design tokens. Core `zyzz` imports remain token-free.

```ts
import { css } from 'zyzz/themes/default'

const card = css({ color: 'blue.700', padding: 4 })
```

| Export     | Contract                                                    |
| ---------- | ----------------------------------------------------------- |
| `css`      | Bound callable authoring with inferred built-in token names |
| `theme`    | Complete theme definition and references                    |
| `tokens`   | Raw token data for reuse and extension                      |
| `variants` | Bound recipe authoring                                      |

Geist colors/typography and spacing/radius scales are opt-in theme data. Use [css](../core/css.md), [Theme](../core/Theme/README.md), and [variants](../core/variants.md) for method contracts.
