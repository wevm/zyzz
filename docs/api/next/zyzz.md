# zyzz

> [!NOTE]
> Preview integration. Next.js 16.3.5 is verified with both bundlers, default build targets, and Chromium 153 rendering. Browser support requires native `light-dark()`. Client JavaScript source maps trace packed variant applications to authored call sites.

Wrap Next.js configuration with source transformation, CSS delivery, and dependency watching. Configure Webpack and Turbopack internally through the same public setup.

```ts
import { zyzz } from 'zyzz/next'

export default zyzz({
  reactStrictMode: true,
})
```

## Signature

`zyzz(nextConfig)`

## Parameters

### nextConfig

- Type: `NextConfig | Promise<NextConfig> | zyzz.Factory`
- Required: Yes. Pass `{}` for an otherwise empty configuration.

Existing application configuration. Options and build hooks/rules are preserved. A factory receives the Next.js phase and `{ defaultConfig }`, returning an object or promise. Function configurations are wrapped in an async factory.

```ts
zyzz({ reactStrictMode: true })
```

## Returns

### nextConfig

- Type: `NextConfig`, `Promise<NextConfig>`, or `zyzz.Factory`, matching the input overload.

Configuration with Zyzz integration attached. It is exported from `next.config.ts`. It does not provide the application's `css` or theme helpers.

```ts
export default zyzz({})
```

## Errors

Compilation and resolution failures are reported through the active bundler. Source diagnostics retain their source locations. Correcting a source error triggers recompilation. File-system errors while creating `.zyzz/next` are thrown during configuration.

The wrapper requires no separate Babel or PostCSS setup. Underlying loaders or transforms remain internal choices, validated separately for Webpack and Turbopack.

See [Next.js Setup](../../introduction/next.md) and the [entrypoint overview](README.md).
