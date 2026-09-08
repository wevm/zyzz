# Themes & Tokens

Define shared tokens, apply theme scopes, and choose light or dark mode. See [Getting Started](../introduction/getting-started.md) for compilation setup.

## Recipes

### Use Themes

> [!NOTE]
> Config authoring is a preview. For current support, see [Compile Local Theme Source](#compile-local-theme-source).

Export a named config instance and use its bound styles:

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export const zyzz = Config.create({
  theme: {
    color: { brand: { dark: '#8cf', light: '#06c' } },
    spacing: { md: '1rem' },
  },
})
```

```tsx
import { zyzz } from './zyzz.config.js'

const button = zyzz.css({ backgroundColor: 'brand', padding: 'md' })

const example = <button {...button()}>Save</button>
```

Token names are inferred from the config. Nested palettes use dotted paths; CSS literals win over colliding token names. See [Theme.define](../api/core/Theme/define.md) for supported groups and values.

### Selecting a Theme

> [!NOTE]
> Config authoring is a preview.

Apply the single theme's scope to an ancestor:

```tsx
import { zyzz } from './zyzz.config.js'

const example = <main className={zyzz.theme.className}>...</main>
```

For alternatives, configure a named catalog with a shared token contract:

```ts
// zyzz.config.ts
import { Config, Theme } from 'zyzz'

const base = Theme.define({ color: { brand: '#06c' } })

export const zyzz = Config.create({
  defaultTheme: 'base',
  themes: {
    base,
    mint: Theme.extend(base, { color: { brand: '#175' } }),
  },
})
```

```tsx
import { zyzz } from './zyzz.config.js'

const card = zyzz.css({ color: 'brand' })

function App({ appearance }: { appearance: 'base' | 'mint' }) {
  return (
    <main className={zyzz.themes[appearance].className}>
      <div {...card()}>Card</div>
    </main>
  )
}
```

Changing the scope updates inherited token values while component styles stay the same. Single-theme configs expose `zyzz.theme`; named catalogs expose `zyzz.themes`. Independently defined themes do not share a contract merely because their token names match.

### Dark Mode

Color tokens accept a shared string or a `{ dark, light }` pair, as in [Use Themes](#use-themes). Select the scheme with ordinary CSS, independently of the theme scope:

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

Use `light dark` for system preference, or `light` / `dark` to force a scheme. No JavaScript preference listener is needed.

### Shared Configuration

> [!NOTE]
> Cross-module config authoring is a preview.

Keep reusable tokens in a shared module and pass them into each application's config:

```ts
// tokens.ts
import { Theme } from 'zyzz'

export const theme = Theme.define({ spacing: { md: '1rem' } })
```

```ts
// zyzz.config.ts
import { Config } from 'zyzz'
import { theme } from './tokens.js'

export const zyzz = Config.create({ theme })
```

Consumers import `{ zyzz }` from the config's stable export. See [Publish Libraries](compilation.md#publish-libraries) for distributing precompiled components.

### Compile Local Theme Source

Current source compilation supports local themes, extensions, bound styles, and scope reads:

```ts
import { Theme } from 'zyzz'

const theme = Theme.define({ color: { brand: '#06c' } })
const alternate = Theme.extend(theme, { color: { brand: '#175' } })
const { css } = theme

export const scope = alternate.className
export const card = css({ color: theme.tokens.color.brand })
```

Compile this module with [Transform.compile](../api/compiler/Transform/compile.md), load its CSS, and apply `scope` to an ancestor of an element using `card()`.

Use explicit `theme.tokens` paths to select tokens whose names collide with CSS literals. Dot access and literal string/numeric brackets are supported.

Local `const` aliases such as `const css = theme.css`, destructuring/renaming, and alias chains are supported. Local themes and aliases must precede their uses. Use [Graph.compile](../api/compiler/Graph/compile.md) or the file host to link relative theme imports and re-exports; packed libraries supply [compiler metadata](../introduction/vite.md#theme-libraries). `theme.vars` remains unsupported. See [source restrictions](../api/compiler/Source/extract.md#theme-source) for details.

### Compile Themes

For tools that already hold in-memory definitions, pass a theme to `Style.define`, then emit CSS:

```ts
import { Style, Theme } from 'zyzz'
import { Css } from 'zyzz/web'

const theme = Theme.define({ color: { brand: '#06c' } })
const styles = Style.define({ card: { color: 'brand' } }, { theme })
const output = Css.compile({ styles, themes: { base: theme } })
```

Load `output.css` and apply `output.classes.card`; `output.themes.base` is the compiler's scope class. Token fallbacks work outside a scope, and unused tokens emit no declarations. See [Css.compile](../api/web/Css/compile.md) for compiler options and output.
