# Dynamic Values

> [!NOTE]
> Preview API; not yet implemented.

Token names infer by property. A text-color token cannot become a spacing token.

| Value                     | Purpose                                             |
| ------------------------- | --------------------------------------------------- |
| `theme.tokens.spacing.md` | Portable typed token reference                      |
| `theme.vars.spacing.md`   | CSS variable reference for web expressions          |
| Query threshold           | Compiled literal; unaffected by theme scope changes |

Callbacks bind per-instance values to precompiled custom properties. Their rule structure stays static.

```tsx
import { css } from 'zyzz'

const bar = css((values: { width: `${number}%` }) => ({
  width: values.width,
}))
const example = <div {...bar({ width: '50%' })} aria-hidden="true" />
```

Calls accept declared inputs plus `className`/`style` overrides. Keep other component props on the element.
