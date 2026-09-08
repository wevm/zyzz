# Config.create

> [!NOTE]
> Preview API; not yet implemented.

Bind style authoring to explicit theme and layer contracts. Default-export the result from `zyzz.config.ts`.

```ts
import { Config } from 'zyzz'

export default Config.create({
  layers: ['base', 'components'],
  theme: { spacing: { md: '1rem' } },
})
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

Named alternatives share config identity without mutating independent definitions. See [Configuration](../../../concepts/configuration.md).

See [Config](README.md) for related methods and types.
