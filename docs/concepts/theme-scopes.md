# Theme Scopes

> [!NOTE]
> Preview API; not yet implemented.

Theme classes select inherited CSS variables. Components keep the same classes across compatible themes; nested scopes change a subtree. Defaults provide fallbacks outside a scope.

Use the returned handles from a [named-theme config](../guides/themes.md#configure-authoring):

```tsx
import config from './zyzz.config.js'

const example = (
  <section
    className={config.themes.mint.className}
    style={{ colorScheme: 'dark' }}
  >
    Content
  </section>
)
```

- **Color pairs:** `{ dark, light }` compiles to `light-dark()`.
- **Color scheme:** `light` or `dark` selects explicitly; `light dark` follows browser preference.
- **Extensions:** `Theme.extend` changes existing values while preserving the contract.
- **Theme selection:** changes tokens independently of color scheme.
