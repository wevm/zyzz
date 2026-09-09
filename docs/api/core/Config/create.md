# Config.create

Bind style authoring to explicit theme and layer contracts. Use `export const { style, theme } = Config.create(...)` from `zyzz.config.ts`; consumers import `{ style }`.

```ts
import { Config } from 'zyzz'

export const { style, theme } = Config.create({
  layers: ['base', 'components'],
  theme: { spacing: { md: '1rem' } },
})
```

The factory, source extraction, and direct `style` calls are implemented. `vars`, `variants`, and layer emission remain planned. Layer keys are inferred but are not yet accepted by source compilation.

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

Ordered plain or dotted CSS identifiers, without duplicates or CSS-wide keywords. The tuple infers exact bound `@layer <name>` keys. Unicode/escaped layer identifiers and layer emission remain planned.

```ts
Config.create({ layers: ['base', 'components'] })
```

### options.shorthands

- Type: Inferred record of nonempty readonly standard-property tuples
- Default: No aliases.

Map custom names to one or more properties. Values infer from all targets; tokens resolve separately for each property. Expansion preserves declaration order. Targets must be supported standard properties, and alias names cannot replace existing properties or reserved keys.

```ts
const { style } = Config.create({
  shorthands: { px: ['paddingLeft', 'paddingRight'] },
  theme: { padding: { md: '1rem' } },
})

const card = style({ px: 'md' })
```

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

Returns `Config.create.ReturnType<options>`: a frozen object with typed `style`, a bound `script` function, and either `theme` or `themes`. Omission returns token-free `style` and a color-scheme-only `script`. Separate calls own isolated contracts and leave supplied definitions unchanged.

### style

- Type: Inferred static authoring returning `style.ReturnType`

Infers configured token and layer names, retaining property checking inside layer bodies. Without a theme, authoring remains token-free. Direct literal calls compile through Vite or the source graph/file host. Untransformed calls throw the missing-transform error.

```ts
const card = style({ padding: 'md' })
```

### theme

- Type: Normalized single-theme definition

Present for single-theme configuration. Apply the scope with `<html style={theme}>`. Use portable token references with the in-memory compiler. Reading `className` before source compilation throws; emitted scope classes come from `Css.compile`.

```ts
theme.tokens.spacing.md
```

### themes

- Type: Normalized named theme catalog

Present for named catalogs. Use `style={themes.mint}` to apply a named scope. Compatible alternatives share config identity without mutating independent definitions.

```ts
const { style, themes } = Config.create({
  defaultTheme: 'base',
  themes: { base: { spacing: { md: '1rem' } } },
})

const token = themes.base.tokens.spacing.md
```

### script

- Type: `(options?: { storageKey?: string }) => string`

Generate an optional inline initialization script using this config's theme catalog. It restores localStorage preferences on `<html>` before first paint. No cookies, provider, or extra import is required.

```ts
const initialization = script()
const custom = script({ storageKey: 'my-app-appearance' })
```

See [Config Script](script.md) for storage, CSP, and hydration behavior.

### variants

- Type: Bound variant authoring (planned)

Infers the same theme and layer contract as bound `style`.

```ts
const button = variants({
  variants: { size: { md: { padding: 'md' } } },
})
```

Planned for Phase 3; not currently returned.

## Errors

`Config.InvalidError` rejects missing/extra token paths, incompatible domains, invalid defaults, unknown options, accessor records, and invalid or duplicate layer names. Named alternatives can mix scalar colors and complete light/dark pairs for the same paths.

Named alternatives share config identity without mutating independent definitions. See [Configuration](../../../concepts.md#configuration).

See [Config](README.md) for related methods and types.

## Named Exports

Use `export const { style, theme } = Config.create(...)` for named consumer imports in consuming modules. Use `style`; access `theme` for single themes or `themes` for named catalogs. Source integrations follow this named instance without requiring a default export. Immutable aliases, named re-exports, and packed declarations retain its contract. `variants` remains planned.

## In-Memory Compilation

```ts
import { Config, Style } from 'zyzz'
import { Css } from 'zyzz/web'

const { style } = Config.create({ theme: { spacing: { md: '1rem' } } })

const output = Css.compile({
  styles: Style.define({ card: { padding: theme.tokens.spacing.md } }),
  themes: { base: theme },
})
```
