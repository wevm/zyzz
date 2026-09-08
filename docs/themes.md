# In-Memory Themes

Define scalar tokens, reference them from named styles, and compile the resulting graph:

```ts
import { Style, Theme } from 'zyzz'
import { Css } from 'zyzz/web'

const theme = Theme.define({
  color: { foreground: { dark: '#fff', light: '#111' } },
  spacing: { md: '1rem' },
})
const alternate = Theme.extend(theme, { spacing: { md: '2rem' } })
const styles = Style.define({
  card: {
    color: theme.tokens.color.foreground,
    padding: theme.tokens.spacing.md,
  },
})
const output = Css.compile({ styles, themes: { alternate, base: theme } })
```

1. Load `output.css`.
2. Apply `output.classes.card` to the component.
3. Optionally apply `output.themes.alternate` to an ancestor.

Token fallbacks work outside a scope. Each scope resets every referenced variable in its contract; unused tokens emit no declarations.

Use ordinary CSS to select schemes:

```css
:root {
  color-scheme: light dark;
}
.light {
  color-scheme: light;
}
.dark {
  color-scheme: dark;
}
```

Shared strings work in both schemes. Pairs compile to `light-dark()`. Theme scopes and scheme selection are independent; neither JavaScript preference listeners nor runtime rule generation are required.

| Group                                         | Accepted Properties                     |
| --------------------------------------------- | --------------------------------------- |
| `backgroundColor`, `borderColor`, `textColor` | Their corresponding color property      |
| `borderRadius`                                | Border radius                           |
| `color`                                       | All supported color properties          |
| `spacing`                                     | Supported spacing and sizing properties |

Nested palettes infer reference paths. Extensions change existing paths only and replace whole color pairs.

Values currently follow the [literal grammar](literal-styles.md): literal colors and nonnegative lengths or zero. Token palettes are nonempty data records with dot-free keys. Definitions copy and freeze inputs; accessors, symbols, cycles, and ambiguous paths are rejected.

Classes and variable slots belong to one in-memory graph. Separate outputs require independent namespaces. Root `css` still accepts only literals at this baseline.

Separate capabilities include:

- Bundled tokens and typography presets.
- Query metadata.
- Source extraction and compiled `theme.className`.
- `theme.vars` expressions.

## Selecting a Theme

Author shared components against one base contract. Create alternatives with `Theme.extend`, then choose a scope from the compiler output at render time:

```tsx
const scopes = output.themes

function App({ appearance }: { appearance: 'alternate' | 'base' }) {
  return (
    <main className={scopes[appearance]}>
      <div className={output.classes.card}>Card</div>
    </main>
  )
}
```

The class selection changes inherited variable values; component styles stay the same. Select light or dark independently through `color-scheme`. Independently defined themes own separate contracts and do not override one another, even when token paths match.

The source-authoring API will expose the equivalent scope through `theme.className`. Choose a bound `theme.css` or `theme.vars` reference while defining styles; select a compatible scope when rendering. Neither selection requires invoking a runtime compiler or a variables function.

## Token Names

Pass the theme explicitly to infer shorthand names in the in-memory pipeline:

```ts
const styles = Style.define(
  { card: { color: 'foreground', padding: 'md' } },
  { theme },
)
const output = Css.compile({ styles, themes: { alternate, base: theme } })
```

Token-aware option bags require a defined theme. An optional theme permits only literals and explicit references until it is narrowed; explicitly undefined groups contribute no shorthand names.

- **Collisions:** CSS literals and zero win; explicit `theme.tokens` references select the token.
- **Colors:** property-specific groups win over shared colors at the same path.
- **Nested palettes:** use dotted names.
- **Numeric spacing keys:** accept numeric or string spelling.

`theme.css` exposes the same inferred property types and callable props contract as root `css`, including literal styling overrides. Its extraction and rewrite support is a separate source-linking step; executing an untransformed call throws `css.MissingTransformError`. The in-memory pipeline above is executable without a transform.
