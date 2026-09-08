# Themes & Tokens

Define token contracts, choose theme scopes, and select color schemes. Begin with [Getting Started](../introduction/getting-started.md) to connect compilation.

## Recipes

### Use Themes

Define shared tokens, then select their values through an inherited theme scope.

#### Configure Authoring

> [!NOTE]
> Preview API; not yet implemented.

```ts
// zyzz.config.ts
import { Config, Theme } from 'zyzz'

const base = Theme.define({
  color: { brand: { dark: '#8cf', light: '#06c' } },
  spacing: { md: '1rem', sm: '0.5rem' },
})

const config = Config.create({
  defaultTheme: 'base',
  layers: ['reset', 'base', 'components'],
  themes: {
    base,
    mint: Theme.extend(base, { color: { brand: '#175' } }),
  },
})

export const { css, themes, variants } = config
export const variables = themes.base.vars
export default config
```

Single-theme configs use `theme: base`, or put the tokens inline. Named catalogs also accept complete inline alternatives. Import returned functions normally; there is no implicit global token or layer registry.

#### Apply Styles and Themes

> [!NOTE]
> Preview API; not yet implemented.

```tsx
import { css, themes } from './zyzz.config.js'

const button = css({
  '@layer components': {
    backgroundColor: 'brand',
    padding: 'md',
    ':hover': { opacity: 0.8 },
  },
})

const example = (
  <section className={themes.mint.className} style={{ colorScheme: 'dark' }}>
    <button {...button()} type="button">
      Save
    </button>
  </section>
)
```

- **Color scheme:** selected through the inline property.
- **Overrides:** pass `className`/`style` to the styling function; keep other props on the element.
- **Theme:** selected through the scope class.
- **Types:** reject unknown layers and token names.

### Dark Mode

> [!NOTE]
> Preview API; not yet implemented.

Define light/dark values on each color leaf. Select the scheme with the ordinary CSS property.

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

const config = Config.create({
  theme: { color: { text: { dark: '#eee', light: '#111' } } },
})

export const { css, theme, variants } = config
export const variables = theme.vars
export default config
```

```tsx
import { css } from './zyzz.config.js'

const text = css({ color: 'text' })
const example = (
  <section style={{ colorScheme: 'dark' }}>
    <p {...text()}>Hello</p>
  </section>
)
```

- **Explicit scheme:** use `light` or `dark`.
- **System preference:** use `light dark`.
- **Theme selection:** use a compatible theme scope independently of scheme.

See [Compile Themes](themes.md#compile-themes) for the current in-memory equivalent.

### Compile Themes

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

Values currently follow the [literal grammar](../api/core/Style/literals.md): literal colors and nonnegative lengths or zero. Token palettes are nonempty data records with dot-free keys. Definitions copy and freeze inputs; accessors, symbols, cycles, and ambiguous paths are rejected.

Classes and variable slots belong to one in-memory graph. Separate outputs require independent namespaces. Root `css` still accepts only literals at this baseline.

> [!NOTE]
> These capabilities are not yet implemented:
>
> - Bundled tokens and typography presets.
> - Query metadata.
> - Source extraction and compiled `theme.className`.
> - `theme.vars` expressions.

#### Selecting a Theme

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

> [!NOTE]
> Source authoring is a preview. It will expose scopes through `theme.className`. Define styles with bound `theme.css` or `theme.vars`, then select a compatible scope when rendering. No runtime compiler or variables function is needed.

#### Token Names

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

### Shared Configuration

> [!NOTE]
> Preview API; not yet implemented.

Keep reusable tokens outside config when several packages share them. Each application explicitly chooses its config contract.

```ts
// tokens.ts
import { Theme } from 'zyzz'

export const theme = Theme.define({ spacing: { md: '1rem' } })
```

```ts
// zyzz.config.ts
import { Config } from 'zyzz'
import { theme } from './tokens.js'

const config = Config.create({ theme })

export const { css, variants } = config
export default config
```

Import named helpers from a stable package export in consuming code. Preserve source/declaration exports so adapters can follow bindings. Independent theme definitions do not become compatible merely because their token paths match.

See [Publish Libraries](compilation.md#publish-libraries) when sharing precompiled components rather than authoring configuration.
