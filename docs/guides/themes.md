# Themes & Tokens

Define shared tokens, apply theme scopes, and choose light or dark mode. See [Getting Started](../introduction/getting-started.md) for compilation setup.

## Recipes

### Use Themes

Export bound helpers directly from the config:

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export const { style, theme, variants } = Config.create({
  theme: {
    color: { brand: { dark: '#8cf', light: '#06c' } },
    spacing: { md: '1rem' },
  },
})
```

```tsx
import { style } from './zyzz.config.js'

namespace styles {
  export const button = style({ backgroundColor: 'brand', padding: 'md' })
}

const example = <button {...styles.button()}>Save</button>
```

Token names are inferred from the config. Nested palettes use dotted paths; CSS literals win over colliding token names. See [Theme.define](../api/core/Theme/define.md) for supported groups and values.

### Property Mappings

Define custom property names with `shorthands` and separate token scales by property:

```ts
import { Config } from 'zyzz'

export const { style } = Config.create({
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

namespace styles {
  export const card = style({ px: 'sm', margin: 'gutter', color: 'primary' })
}
```

`px`, `paddingX`, and `paddingHorizontal` each set left/right padding. Use logical targets such as `paddingInlineStart` and `paddingInlineEnd` for writing-direction-aware aliases. Aliases are optional and local to the config.

`margin` and `padding` tokens augment `spacing`, taking precedence for matching keys. Either works without `spacing`. Likewise, `textColor` augments `color` for text only. A margin-only token cannot be used for padding; `textColor` does not supply background tokens.

The example uses `padding.sm` for `px`, `margin.gutter` for margin, and `textColor.primary` for color. Later declarations override earlier aliases at equal importance. See [Config.create](../api/core/Config/create.md#optionsshorthands).

### Selecting a Theme

Configure a named catalog with a shared token contract:

```ts
// zyzz.config.ts
import { Config, Theme } from 'zyzz'

const base = Theme.define({ color: { brand: '#06c' } })

export const { script, style, themes } = Config.create({
  defaultTheme: 'base',
  themes: {
    base,
    mint: Theme.extend(base, { color: { brand: '#175' } }),
  },
})
```

```tsx
import { style, themes } from './zyzz.config.js'

namespace styles {
  export const card = style({ color: 'brand' })
}

function App({ appearance }: { appearance: 'base' | 'mint' }) {
  return (
    <html {...themes({ theme: appearance })}>
      <head>
        <title>My App</title>
      </head>
      <body>
        <div {...styles.card()}>Card</div>
      </body>
    </html>
  )
}
```

Changing the scope updates inherited token values while component styles stay the same. Single-theme configs expose `theme`; named catalogs expose `themes`. Independently defined themes do not share a contract merely because their token names match.

<a id="dark-mode"></a>

### Color Schemes

Color tokens accept a shared string or a `{ dark, light }` pair, as in [Use Themes](#use-themes). Use the named catalog above and pass the scheme when selecting a theme:

```tsx
import { themes } from './zyzz.config.js'

const example = (
  <html {...themes({ theme: 'base', colorScheme: 'light dark' })}>
    <head>
      <title>My App</title>
    </head>
    <body>Content</body>
  </html>
)
```

Use `light dark` for system preference, or `light` / `dark` to force a scheme. The call returns the scope class, a compiled scheme class, and an inline `colorScheme` style. The scheme class carries `color-scheme` in the stylesheet, so bundlers that lower `light-dark()` still resolve the pair. Omitting `colorScheme` preserves inherited CSS behavior. Nested scopes can select a different theme, scheme, or both.

### Restore Preferences

Use an optional initialization script when preferences persist in localStorage. Render the default theme and scheme on `<html>`; place the inline script early in `<head>`, before stylesheets and visible content. It requires no cookies, provider, or preference listener.

The following uses the named catalog from [Selecting a Theme](#selecting-a-theme):

```tsx
import { script, themes } from './zyzz.config.js'

const initialization = script()

export function Document({ nonce }: { nonce?: string }) {
  return (
    <html
      {...themes({ theme: 'base', colorScheme: 'light dark' })}
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

The script derives the theme catalog and compiled classes from the config and reads the entry named by the config's `storageKey`, `'zyzz'` by default.

The application saves preferences under `zyzz`:

```ts
localStorage.setItem(
  'zyzz',
  JSON.stringify({ theme: 'mint', colorScheme: 'dark' }),
)
```

The script reads this record once and updates only known theme and scheme classes plus `document.documentElement.style.colorScheme`. Unrelated classes and styles remain intact.

The [Vite plugin](../introduction/vite.md) inlines the script into `index.html` automatically. Client code manages the same record through the config's [`appearance`](../api/core/Config/create.md#appearance) controls:

```ts
import { appearance } from './zyzz.config.js'

const initial = appearance.get() // { theme: 'base', colorScheme: 'dark' } after restoration
appearance.set({ colorScheme: 'light dark' })
```

`get()` reads the applied root state and `set()` applies fields over it and saves the result. A `storageKey` on `Config.create` changes the record both helpers use. Unknown preferences, malformed data, or unavailable storage preserve the corresponding server-rendered defaults.

React's `suppressHydrationWarning` is limited to the root attributes changed before hydration. Preference controls should initialize from the applied root state before changing it; the script does not synchronize component state or persist later changes. See [Config Script](../api/core/Config/script.md) for the full contract.

### Shared Configuration

Cross-module configuration is implemented through the Vite adapter and `Graph.compile`. Standalone single-module transforms require their imported contracts to be linked through the graph.

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

export const { style } = Config.create({ theme })
```

Consumers import named helpers from the config's stable exports. See [Publish Libraries](compilation.md#publish-libraries) for distributing precompiled components.

### Compile Local Theme Source

Current source compilation supports local themes, extensions, bound styles, and scope reads:

```ts
import { Theme } from 'zyzz'

const theme = Theme.define({ color: { brand: '#06c' } })
const alternate = Theme.extend(theme, { color: { brand: '#175' } })
const { style } = theme

export const scope = alternate.className
export namespace styles {
  export const card = style({ color: theme.tokens.color.brand })
}
```

Compile this module with [Transform.compile](../api/compiler/Transform/compile.md), load its CSS, and apply `scope` to an ancestor of an element using `styles.card()`.

Use explicit `theme.tokens` paths to select tokens whose names collide with CSS literals. Dot access and literal string/numeric brackets are supported.

Local `const` aliases such as `const style = theme.style`, destructuring/renaming, and alias chains are supported. Local themes and aliases must precede their uses. Use [Graph.compile](../api/compiler/Graph/compile.md) or the file host to link relative theme imports and re-exports; packed libraries supply [compiler metadata](../introduction/vite.md#theme-libraries). `theme.vars` supports direct scalar references and template interpolation, including imported and packed contracts. Standalone variable destructuring remains unsupported. See [source restrictions](../api/compiler/Source/extract.md#theme-source) for details.

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
