# zyzz

> [!NOTE]
> Verified with Next.js 16.3.4 App Router applications on webpack and Turbopack. The Pages Router, relative stylesheet assets, and unimported stylesheet contributions remain separate gates.

Wrap Next.js configuration with source transformation, CSS delivery, and dependency watching. Webpack and Turbopack are configured internally through the same public setup.

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

- Type: `NextConfig` from `next`
- Required: Yes; pass `{}` for an otherwise empty configuration.

Existing application configuration. Its options are preserved. Existing `turbopack.rules` entries for the same file glob and an existing `webpack` hook run first; the Zyzz rules are appended after them.

```ts
zyzz({
  reactStrictMode: true,
  turbopack: { rules: { '*.svg': { as: '*.js', loaders: ['@svgr/webpack'] } } },
  webpack(config) {
    return config
  },
})
```

## Returns

### nextConfig

- Type: `NextConfig` from `next`

Configuration with the Zyzz loader attached to both bundlers. Export it from `next.config.ts`; it does not provide the application's `css` or theme helpers.

```ts
export default zyzz({})
```

## Errors

Asynchronous and function-valued configurations throw a `TypeError`; pass the resolved object instead. A `webpack` hook that does not return a webpack configuration fails when Next.js builds.

Extraction and compiler diagnostics keep their source locations and surface in the development overlay for the importing module; the last successful output remains served until the source is fixed. Relative stylesheet assets referenced by contributions fail with an explicit error.

Both bundlers reuse the graph compiler behind `zyzz/vite`; loader selection remains internal. See [Next.js Setup](../../introduction/next.md) and the [entrypoint overview](README.md).
