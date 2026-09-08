# Config.create

> [!NOTE]
> Preview API; not yet implemented.

Bind style authoring to explicit theme and layer contracts. Export bound helpers from `zyzz.config.ts`; retain the config as its default export.

```ts
import { Config } from 'zyzz'

const config = Config.create({
  layers: ['base', 'components'],
  theme: { spacing: { md: '1rem' } },
})

export const { css, theme, variants } = config
export const variables = theme.vars
export default config
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
const card = config.css({ padding: 'md' })
```

### theme

- Type: Normalized single-theme definition

Present for single-theme configuration. Alias its typed CSS references as the named `variables` export.

```ts
export const variables = config.theme.vars
```

### themes

- Type: Normalized named theme catalog

Present for named catalogs. Compatible alternatives share config identity without mutating independent definitions.

```ts
const { themes } = Config.create({
  defaultTheme: 'base',
  themes: { base: { spacing: { md: '1rem' } } },
})
const scope = themes.base.className
```

### variants

- Type: Bound variant authoring

Infers the same theme and layer contract as bound css.

```ts
const button = config.variants({
  variants: { size: { md: { padding: 'md' } } },
})
```

## Errors

Reject missing/extra token paths, incompatible domains, invalid defaults, and invalid layer names. Exact diagnostic types remain part of implementation.

Named alternatives share config identity without mutating independent definitions. See [Configuration](../../../concepts.md#configuration).

See [Config](README.md) for related methods and types.

## Named Exports

Export `css` and `variants` from the returned config. Export `variables = theme.vars` for a single theme, or alias the default named theme's `vars`. Keep default config export for integrations. These aliases preserve inference; they do not introduce another Config method.
