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

- `defaultTheme`: inferred catalog key selecting paths, domains, and fallback values.
- `layers`: ordered layer names; their order defines cascade order.
- `theme`: inline tokens or a reusable definition; mutually exclusive with `themes`.
- `themes`: named complete alternatives; requires `defaultTheme`.

## Returns

Bound `css` and `variants`, plus `theme` or normalized `themes`. Without a theme, authoring remains token-free. Layer keys infer as exact `@layer <name>` strings.

## Errors

Reject missing/extra token paths, incompatible domains, invalid defaults, and invalid layer names. Exact diagnostic types remain part of implementation.

Named alternatives share config identity without mutating independent definitions. See [Configuration](../../../concepts.md#configuration).

See [Config](README.md) for related methods and types.

## Named Exports

Export `css` and `variants` from the returned config. Export `variables = theme.vars` for a single theme, or alias the default named theme's `vars`. Keep default config export for integrations. These aliases preserve inference; they do not introduce another Config method.
