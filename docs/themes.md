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

Load `output.css`, apply `output.classes.card` to a component, and optionally apply `output.themes.alternate` to an ancestor. References include defining fallbacks, so the component also works outside a theme scope. Each scope resets every referenced variable in its contract. Unreferenced tokens emit no declarations.

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

Supported groups are `backgroundColor`, `borderColor`, `borderRadius`, `color`, `spacing`, and `textColor`. Nested palettes infer reference paths. Property-specific groups only work in their own domains; shared colors work in all supported color properties. Extensions accept existing paths only and replace whole color pairs.

Values currently follow the [literal grammar](literal-styles.md): literal colors and nonnegative lengths or zero. Token palettes are nonempty data records with dot-free keys. Definitions copy and freeze inputs; accessors, symbols, cycles, and ambiguous paths are rejected.

This entrypoint compiles one in-memory graph. Its classes and variable slots are graph-local; separate outputs require independent namespaces. Theme source extraction, bound `theme.css`, compiled `theme.className`, `theme.vars`, bundled tokens, typography presets, and query metadata are separate capabilities. Root `css` still accepts only literals.

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
