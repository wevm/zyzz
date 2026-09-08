# Config.create

> [!NOTE]
> Preview API; not yet implemented.

Bind style authoring to explicit theme and layer contracts. Export the config as `zyzz` from `zyzz.config.ts` and consume its members through a named import.

```ts
import { Config } from 'zyzz'

export const zyzz = Config.create({
  layers: ['base', 'components'],
  theme: { spacing: { md: '1rem' } },
})
```

## Signature

`Config.create(options)`

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

Ordered layer names defining cascade order and exact bound `@layer <name>` keys.

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

The preview contract returns bound helpers plus `theme` or `themes`, according to the input form. Public type names remain to be finalized.

### css

- Type: Bound callable style authoring

Infers configured token and layer names. Without a theme, authoring remains token-free.

```ts
const card = zyzz.css({ padding: 'md' })
```

### theme

- Type: Normalized single-theme definition

Present for single-theme configuration. Access typed CSS references through `zyzz.theme.vars`.

```ts
zyzz.theme.vars.spacing.md
```

### themes

- Type: Normalized named theme catalog

Present for named catalogs. Compatible alternatives share config identity without mutating independent definitions.

```ts
const zyzz = Config.create({
  defaultTheme: 'base',
  themes: { base: { spacing: { md: '1rem' } } },
})
const scope = zyzz.themes.base.className
```

### variants

- Type: Bound variant authoring

Infers the same theme and layer contract as bound css.

```ts
const button = zyzz.variants({
  variants: { size: { md: { padding: 'md' } } },
})
```

## Errors

Reject missing/extra token paths, incompatible domains, invalid defaults, and invalid layer names. Exact diagnostic types remain part of implementation.

Named alternatives share config identity without mutating independent definitions. See [Configuration](../../../concepts.md#configuration).

See [Config](README.md) for related methods and types.

## Named Exports

Export `const zyzz = Config.create(...)` and import `{ zyzz }` in consuming modules. Use `zyzz.css` and `zyzz.variants`; access `zyzz.theme` for single themes or `zyzz.themes` for named catalogs. Integrations follow the named instance without requiring a default export.
