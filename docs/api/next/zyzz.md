# zyzz

Wrap Next.js configuration with source transformation, CSS delivery, and dependency watching. Configure Webpack and Turbopack internally through the same public setup.

```ts
import { zyzz } from 'zyzz/next'

export default zyzz({
  reactStrictMode: true,
})
```

Preview API; not yet implemented.

## Signature

`zyzz(nextConfig)`

## Parameters

### nextConfig

- Type: Next.js configuration object (`NextConfig`)
- Required: Yes; pass `{}` for an otherwise empty configuration.

Existing application configuration. Preserve its options and compose existing build hooks and rules. Support for asynchronous or function-valued configurations remains to be specified and verified.

```ts
zyzz({ reactStrictMode: true })
```

## Returns

### nextConfig

- Type: Next.js-compatible configuration; exact public return type remains to be finalized.

Configuration with Zyzz integration attached. It is exported from `next.config.ts`; it does not provide the application's `style` or theme helpers.

```ts
export default zyzz({})
```

## Errors

Source and target errors retain their locations. Unsupported configuration combinations must produce actionable diagnostics. Failed development compilation preserves the last complete output. Exact diagnostic types remain an implementation gate.

The wrapper requires no separate Babel or PostCSS setup. Underlying loaders or transforms remain internal choices, validated separately for Webpack and Turbopack.

See [Next.js Setup](../../introduction/next.md) and the [entrypoint overview](README.md).
