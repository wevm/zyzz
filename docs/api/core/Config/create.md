# Config.create

> [!NOTE]
> Named config exports, callable theme selection, variables, and layer compilation are implemented. The initialization `script` is supported; `variants` supports token-aware recipes.

Bind style authoring to explicit theme and layer contracts. Export helpers directly from `zyzz.config.ts` and consume them through named imports.

```ts
import { Config } from 'zyzz'

export const { css, theme } = Config.create({
  layers: ['base', 'components'],
  theme: { spacing: { md: '1rem' } },
})
```

## Signature

`Config.create(options = {})`

## Parameters

### options.cssOutput

> [!NOTE]
> Supported by source compilation and version 17 packed contracts. The CSS-only CLI redesign and complete framework/benchmark acceptance remain planned.

- Type: `'atomic' | 'grouped'`
- Default: `'atomic'`

Selects the emitted CSS representation for bound styles, variants, and theme helpers. Atomic mode shares individual declarations; grouped mode emits scoped declaration blocks. Renderer `output` remains independent.

```ts
export const { css, variants } = Config.create({ cssOutput: 'grouped' })
```

Source compilation retains this setting. Packed contract and CLI propagation remain separate acceptance gates. See [CSS Output](../../../guides/css-output.md) for examples and acceptance boundaries.

### options.defaultTheme

- Type: Catalog key (inferred)
- Required: With `themes`.

Selects the default token paths, domains, and fallback values.

```ts
Config.create({
  defaultTheme: 'base',
  themes: { base: { spacing: { md: '1rem' } } },
})
```

### options.layers

- Type: `readonly string[]` (literal names inferred)
- Default: No configured layers.

Ordered plain or dotted CSS identifiers, without duplicates or CSS-wide keywords. The tuple infers exact bound `@layer <name>` keys. Layer order and bodies compile to CSS. Unicode and escaped layer identifiers remain planned.

```ts
Config.create({ layers: ['base', 'components'] })
```

### options.shorthands

- Type: Inferred record of nonempty readonly standard-property tuples
- Default: No aliases.

Map custom names to one or more properties. Values infer from all targets; tokens resolve separately for each property. Expansion preserves declaration order. Targets must be supported standard properties, and alias names cannot replace existing properties or reserved keys.

```ts
const { css } = Config.create({
  shorthands: { px: ['paddingLeft', 'paddingRight'] },
  theme: { padding: { md: '1rem' } },
})
namespace styles {
  export const card = css({ px: 'md' })
}
```

Dedicated `margin` and `padding` groups take precedence over `spacing` for their properties. Margin tokens accept signed lengths; padding tokens require nonnegative lengths. Empty or duplicate target lists, alias chains, unknown targets, and names colliding with authoring keys are rejected.

See [Property Mappings](../../../guides/themes.md#property-mappings) for aliases and property-specific token scales.

### options.storageKey

- Type: `string`
- Default: `'zyzz'`

localStorage key shared by [`script()`](script.md) and [`appearance`](#appearance). The record holds `theme` and `colorScheme` fields.

```ts
Config.create({ defaultTheme: 'base', storageKey: 'my-app-appearance', themes })
```

### options.theme

- Type: Inline token data or a theme definition
- Default: No theme; token-free authoring.

Single theme contract. Mutually exclusive with `themes`.

```ts
Config.create({ theme: { spacing: { md: '1rem' } } })
```

### options.themes

- Type: Named complete theme alternatives
- Default: No named catalog.

Compatible named themes; requires `defaultTheme`.

```ts
Config.create({
  defaultTheme: 'base',
  themes: { base: { spacing: { md: '1rem' } } },
})
```

## Returns

### appearance

- Type: `{ get: () => Selection; set: (selection: Partial<Selection>) => void }`

Root selection controls over `document.documentElement`. `get()` reads the theme and scheme classes the root carries, reporting `defaultTheme` when no catalog class is present. `set()` applies the given fields over the current selection, swaps the scope and scheme classes plus the inline `color-scheme`, and saves the result under the storage key for the next visit. Token-free and single-theme configurations select only `colorScheme`.

```ts
const { appearance } = Config.create({ defaultTheme: 'base', themes })

appearance.set({ colorScheme: 'dark' })
appearance.get() // { theme: 'base', colorScheme: 'dark' }
```

Creation reads no browser state; the initialization [`script()`](script.md) restores the saved record before first paint, and `get()` then reflects it. Unknown themes or schemes throw `TypeError`.

Returns `Config.create.ReturnType<options>`: a frozen object with typed `css` and `variants`, a bound `script` function, and either `theme` or `themes`. Omission returns token-free `css` and a color-scheme-only `script`. Separate calls own isolated contracts and leave supplied definitions unchanged.

### css

- Type: Inferred callable authoring returning `css.ReturnType`

Infers configured token and layer names, retaining property checking inside layer bodies. Without a theme, authoring remains token-free. Direct literal calls compile through Vite or the source graph/file host. Untransformed calls throw the missing-transform error.

```ts
namespace styles {
  export const card = css({ padding: 'md' })
}
```

### theme

- Type: Normalized callable single-theme definition

Present for single-theme configuration and as the default theme of a named catalog. The default `theme` is a reference handle. Callable standalone theme application remains preview; use `themes({ theme: defaultName, colorScheme: 'light dark' })` for a named catalog. Use portable token references with the in-memory compiler. Reading `className` before source compilation throws; emitted scope classes come from `Css.compile`.

```ts
theme.tokens.spacing.md
```

### themes

- Type: `(options: { theme: Name; colorScheme?: 'light' | 'dark' | 'light dark' }) => ThemeProps` (provisional names)

Present for named catalogs. Call `themes({ theme: 'mint', colorScheme: 'dark' })` to apply a named scope. Compatible alternatives share config identity without mutating independent definitions.

```ts
const { themes } = Config.create({
  defaultTheme: 'base',
  themes: { base: { spacing: { md: '1rem' } } },
})
const props = themes({ theme: 'base', colorScheme: 'light dark' })
```

`options.theme` is required and inferred from the configured catalog keys. Runtime selection uses the same call, such as `themes({ theme: appearance })`. Omitted `colorScheme` preserves inherited CSS behavior. The returned props contain the selected scope class and, only when a scheme is supplied, its compiled scheme class and an inline scheme.

### script

- Type: `() => string`

Generate an optional inline initialization script using this config's theme catalog. It restores localStorage preferences on `<html>` before first paint from the entry named by [`options.storageKey`](#optionsstoragekey). No cookies, provider, or extra import is required.

```ts
const initialization = script()
```

See [Config Script](script.md) for storage, CSP, and hydration behavior.

### variants

- Type: Bound variant authoring with inferred axes and styling props

Infers the same theme and layer contract as bound css.

```ts
namespace styles {
  export const button = variants({
    variants: { size: { md: { padding: 'md' } } },
  })
}
```

## Errors

`Config.InvalidError` rejects missing/extra token paths, incompatible domains, invalid defaults, unknown options, accessor records, and invalid or duplicate layer names. Named alternatives can mix scalar colors and complete light/dark pairs for the same paths.

Named alternatives share config identity without mutating independent definitions. See [Configuration](../../../concepts.md#configuration).

See [Config](README.md) for related methods and types.

## Named Exports

Export `const { css, theme } = Config.create(...)` and import `{ css, theme }` in consuming modules. Use `css`; access `theme` for single themes or `themes` for named catalogs. Source integrations follow these named exports without requiring a default export. Immutable aliases, named re-exports, and packed declarations retain its contract. `variants` supports token-aware recipes.

## In-Memory Compilation

```ts
import { Config, Style } from 'zyzz'
import { Css } from 'zyzz/web'

const { theme } = Config.create({ theme: { spacing: { md: '1rem' } } })
const output = Css.compile({
  styles: Style.define({ card: { padding: theme.tokens.spacing.md } }),
  themes: { base: theme },
})
```

## Renderer Output

`output` defaults to `'react'`, returning `className` and an inline style object. Select `'html'` for native attribute binding in Solid, Vue, and Svelte:

```ts
export const { css } = Config.create({ output: 'html' })
namespace styles {
  export const card = css({ padding: '8px' })
}
```

`styles.card()` returns `class` and an optional serialized CSS `style` string. Styling overrides retain the same `className` and typed `style` inputs. Conversion belongs to compiled bindings; application code spreads or binds the result directly.

Padding token literals are checked as nonnegative during typed authoring. Widened and JavaScript inputs follow the repository-wide contract of no runtime CSS-value validation.
