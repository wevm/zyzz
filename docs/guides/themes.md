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

const config = Config.create({
  theme: {
    color: { brand: { dark: '#8cf', light: '#06c' } },
    spacing: { md: '1rem' },
  },
})

export const style = config.style
export const theme = config.theme
```

```tsx
import { style } from './zyzz.config.js'

const styles = {
  button: style({ backgroundColor: 'brand', padding: 'md' }),
}

const example = <button style={styles.button}>Save</button>
```

Token names are inferred from the config. Nested palettes use dotted paths; CSS literals win over colliding token names. See [Theme.define](../api/core/Theme/define.md) for supported groups and values.

### Property Mappings

Define custom property names with `shorthands` and separate token scales by property:

```ts
import { Config } from 'zyzz'

const config = Config.create({
  shorthands: {
    px: ['paddingLeft', 'paddingRight'],
    paddingX: ['paddingLeft', 'paddingRight'],
    paddingHorizontal: ['paddingLeft', 'paddingRight'],
  },
  theme: {
    spacing: { sm: '0.5rem' },
    margin: { sm: '0.75rem', gutter: '2rem' },
    padding: { sm: '1rem' },
    textColor: { primary: '#111' },
  },
})

export const style = config.style
export const theme = config.theme

const styles = {
  card: style({ px: 'sm', margin: 'gutter', color: 'primary' }),
}
```

`px`, `paddingX`, and `paddingHorizontal` each set left/right padding. Use logical targets such as `paddingInlineStart` and `paddingInlineEnd` for writing-direction-aware aliases. Aliases are optional and local to the config.

`margin` and `padding` tokens augment `spacing`, taking precedence for matching keys. Either works without `spacing`. Likewise, `textColor` augments `color` for text only. A margin-only token cannot be used for padding; `textColor` does not supply background tokens.

The example uses `padding.sm` for `px`, `margin.gutter` for margin, and `textColor.primary` for color. Later declarations override earlier aliases at equal importance. See [Config.create](../api/core/Config/create.md#optionsshorthands).

### Selecting a Theme

> [!NOTE]
> Config authoring is a preview.

Apply the single theme's scope to the document root:

```tsx
import { theme } from './zyzz.config.js'

const example = (
  <html {...theme()}>
    <head>
      <title>My App</title>
    </head>
    <body>Content</body>
  </html>
)
```

For alternatives, configure a named catalog with a shared token contract:

```ts
// zyzz.config.ts
import { Config, Theme } from 'zyzz'

const base = Theme.define({ color: { brand: '#06c' } })

const config = Config.create({
  defaultTheme: 'base',
  themes: {
    base,
    mint: Theme.extend(base, { color: { brand: '#175' } }),
  },
})

export const style = config.style
export const themes = config.themes
```

```tsx
import { style, themes } from './zyzz.config.js'

const styles = {
  card: style({ color: 'brand' }),
}

function App({ appearance }: { appearance: 'base' | 'mint' }) {
  return (
    <html {...themes[appearance]()}>
      <head>
        <title>My App</title>
      </head>
      <body>
        <div style={styles.card}>Card</div>
      </body>
    </html>
  )
}
```

Changing the scope updates inherited token values while component styles stay the same. Single-theme configs expose `zyzz.theme`; named catalogs expose `zyzz.themes`. Independently defined themes do not share a contract merely because their token names match.

<a id="dark-mode"></a>

### Color Schemes

Color tokens accept a shared string or a `{ dark, light }` pair, as in [Use Themes](#use-themes). Pass the scheme when applying the theme:

```tsx
import { theme } from './zyzz.config.js'

const example = (
  <html {...theme({ colorScheme: 'light dark' })}>
    <head>
      <title>My App</title>
    </head>
    <body>Content</body>
  </html>
)
```

Use `light dark` for system preference, or `light` / `dark` to force a scheme. The call returns the scope class and an inline `colorScheme` style. Omitting `colorScheme` preserves inherited CSS behavior. Nested scopes can select a different theme, scheme, or both.

### Restore Preferences

Use an optional initialization script when preferences persist in localStorage. Render the default theme and scheme on `<html>`; place the inline script early in `<head>`, before stylesheets and visible content. It requires no cookies, provider, or preference listener.

The following uses the named catalog from [Selecting a Theme](#selecting-a-theme):

```tsx
import { script, themes } from './zyzz.config.js'

const initialization = script()

export function Document({ nonce }: { nonce?: string }) {
  return (
    <html
      {...themes.base({ colorScheme: 'light dark' })}
      suppressHydrationWarning
    >
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: initialization }}
        />
        <title>My App</title>
      </head>
      <body>Content</body>
    </html>
  )
}
```

The script derives the theme catalog and compiled classes from the config. An optional argument sets `storageKey`; its default is `'zyzz'`.

The application saves preferences under `zyzz`:

```ts
localStorage.setItem(
  'zyzz',
  JSON.stringify({ theme: 'mint', colorScheme: 'dark' }),
)
```

The script reads this record once and updates only known theme classes and `document.documentElement.style.colorScheme`. Unrelated classes and styles remain intact. Unknown preferences, malformed data, or unavailable storage preserve the corresponding server-rendered defaults.

React's `suppressHydrationWarning` is limited to the root attributes changed before hydration. Preference controls should initialize from the applied root state before changing it; the script does not synchronize component state or persist later changes. See [Config Script](../api/core/Config/script.md) for the full contract.

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

const config = Config.create({ theme })

export const style = config.style
```

Consumers import named helpers such as `{ style, theme }` from the config's stable exports. See [Publish Libraries](compilation.md#publish-libraries) for distributing precompiled components.

### Compile Local Theme Source

Current source compilation supports local themes, extensions, bound styles, and scope reads:

```ts
import { Theme } from 'zyzz'

const theme = Theme.define({ color: { brand: '#06c' } })
const alternate = Theme.extend(theme, { color: { brand: '#175' } })
const { style } = theme

export const scope = alternate.className
export const card = style({ color: theme.tokens.color.brand })
```

Compile this module with [Transform.compile](../api/compiler/Transform/compile.md), load its CSS, and apply `scope` to an ancestor of an element using `style={card}`.

Use explicit `theme.tokens` paths to select tokens whose names collide with CSS literals. Dot access and literal string/numeric brackets are supported.

Local `const` aliases such as `const style = theme.style`, destructuring/renaming, and alias chains are supported. Local themes and aliases must precede their uses. Use [Graph.compile](../api/compiler/Graph/compile.md) or the file host to link relative theme imports and re-exports; packed libraries supply [compiler metadata](../introduction/vite.md#theme-libraries). `theme.vars` remains unsupported. See [source restrictions](../api/compiler/Source/extract.md#theme-source) for details.

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
