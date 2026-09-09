# Config.create

> [!NOTE]
> The factory, source extraction, and direct `zyzz.css` calls are implemented. `vars`, `variants`, and layer emission remain planned. Layer keys are inferred but are not yet accepted by source compilation.

Bind style authoring to explicit theme and layer contracts. Export the config as `zyzz` from `zyzz.config.ts` and consume its members through a named import.

```ts
import { Config } from 'zyzz'

export const zyzz = Config.create({
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

Ordered plain or dotted CSS identifiers, without duplicates or CSS-wide keywords. The tuple infers exact bound `@layer <name>` keys. Unicode/escaped layer identifiers and layer emission remain planned.

```ts
Config.create({ layers: ['base', 'components'] })
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

Returns `Config.create.ReturnType<options>`: a frozen object with typed `css`, a bound `script` function, and either `theme` or `themes`. Omission returns token-free `css` and a color-scheme-only `script`. Separate calls own isolated contracts and leave supplied definitions unchanged.

### css

- Type: Inferred callable authoring returning `css.ReturnType`

Infers configured token and layer names, retaining property checking inside layer bodies. Without a theme, authoring remains token-free. Direct literal calls compile through Vite or the source graph/file host. Untransformed calls throw the missing-transform error.

```ts
const card = zyzz.css({ padding: 'md' })
```

### theme

- Type: Normalized callable single-theme definition

Present for single-theme configuration. Call `zyzz.theme({ colorScheme: 'light dark' })` to spread root props onto `<html>`. Use portable token references with the in-memory compiler. Reading `className` before source compilation throws; emitted scope classes come from `Css.compile`.

```ts
zyzz.theme.tokens.spacing.md
```

### themes

- Type: Normalized named theme catalog

Present for named catalogs. Call `zyzz.themes.mint({ colorScheme: 'dark' })` to apply a named scope. Compatible alternatives share config identity without mutating independent definitions.

```ts
const zyzz = Config.create({
  defaultTheme: 'base',
  themes: { base: { spacing: { md: '1rem' } } },
})
const token = zyzz.themes.base.tokens.spacing.md
```

### script

- Type: `(options?: { storageKey?: string }) => string`

Generate an optional inline initialization script using this config's theme catalog. It restores localStorage preferences on `<html>` before first paint. No cookies, provider, or extra import is required.

```ts
const script = zyzz.script()
const custom = zyzz.script({ storageKey: 'my-app-appearance' })
```

See [Config Script](script.md) for storage, CSP, and hydration behavior.

### variants

> [!NOTE]
> Planned for Phase 3; not currently returned.

- Type: Bound variant authoring (planned)

Infers the same theme and layer contract as bound css.

```ts
const button = zyzz.variants({
  variants: { size: { md: { padding: 'md' } } },
})
```

## Errors

`Config.InvalidError` rejects missing/extra token paths, incompatible domains, invalid defaults, unknown options, accessor records, and invalid or duplicate layer names. Named alternatives can mix scalar colors and complete light/dark pairs for the same paths.

Named alternatives share config identity without mutating independent definitions. See [Configuration](../../../concepts.md#configuration).

See [Config](README.md) for related methods and types.

## Named Exports

Export `const zyzz = Config.create(...)` and import `{ zyzz }` in consuming modules. Use `zyzz.css`; access `zyzz.theme` for single themes or `zyzz.themes` for named catalogs. Source integrations follow this named instance without requiring a default export. Immutable aliases, named re-exports, and packed declarations retain its contract. `zyzz.variants` remains planned.

## In-Memory Compilation

```ts
import { Config, Style } from 'zyzz'
import { Css } from 'zyzz/web'

const zyzz = Config.create({ theme: { spacing: { md: '1rem' } } })
const output = Css.compile({
  styles: Style.define({ card: { padding: zyzz.theme.tokens.spacing.md } }),
  themes: { base: zyzz.theme },
})
```
