# Config.create

> [!NOTE]
> Named config exports, callable theme selection, variables, and layer compilation are implemented. The initialization `script` is supported; `variants` remains planned.

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
namespace style {
  export const card = css({ px: 'md' })
}
```

Dedicated `margin` and `padding` groups take precedence over `spacing` for their properties. Margin tokens accept signed lengths; padding tokens require nonnegative lengths. Empty or duplicate target lists, alias chains, unknown targets, and names colliding with authoring keys are rejected.

See [Property Mappings](../../../guides/themes.md#property-mappings) for aliases and property-specific token scales.

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

Returns `Config.create.ReturnType<options>`: a frozen object with typed `css`, a bound `script` function, and either `theme` or `themes`. Omission returns token-free `css` and a color-scheme-only `script`. Separate calls own isolated contracts and leave supplied definitions unchanged.

### css

- Type: Inferred callable authoring returning `css.ReturnType`

Infers configured token and layer names, retaining property checking inside layer bodies. Without a theme, authoring remains token-free. Direct literal calls compile through Vite or the source graph/file host. Untransformed calls throw the missing-transform error.

```ts
namespace style {
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

`options.theme` is required and inferred from the configured catalog keys. Runtime selection uses the same call, such as `themes({ theme: appearance })`. Omitted `colorScheme` preserves inherited CSS behavior. The returned props contain the selected scope class and an inline scheme only when supplied.

### script

- Type: `(options?: { storageKey?: string }) => string`

Generate an optional inline initialization script using this config's theme catalog. It restores localStorage preferences on `<html>` before first paint. No cookies, provider, or extra import is required.

```ts
const initialization = script()
const custom = script({ storageKey: 'my-app-appearance' })
```

See [Config Script](script.md) for storage, CSP, and hydration behavior.

### variants

> [!NOTE]
> Planned for Phase 3; not currently returned.

- Type: Bound variant authoring (planned)

Infers the same theme and layer contract as bound css.

```ts
namespace style {
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

Export `const { css, theme } = Config.create(...)` and import `{ css, theme }` in consuming modules. Use `css`; access `theme` for single themes or `themes` for named catalogs. Source integrations follow these named exports without requiring a default export. Immutable aliases, named re-exports, and packed declarations retain its contract. `variants` remains planned.

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
namespace style {
  export const card = css({ padding: '8px' })
}
```

`style.card()` returns `class` and an optional serialized CSS `style` string. Styling overrides retain the same `className` and typed `style` inputs. Conversion belongs to compiled bindings; application code spreads or binds the result directly.

Padding token literals are checked as nonnegative during typed authoring. Widened and JavaScript inputs follow the repository-wide contract of no runtime CSS-value validation.
