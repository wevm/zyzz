# zyzz

> [!NOTE]
> Next.js 16.3.5 is verified with both bundlers, default build targets, and Chromium 153 rendering; browser support requires native `light-dark()`; client JavaScript source maps trace packed variant applications to authored call sites.

Wrap Next.js configuration with source transformation, CSS delivery, and dependency watching. Configure Webpack and Turbopack internally through the same public setup.

```ts
import { zyzz } from 'zyzz/next'

export default zyzz({
  reactStrictMode: true,
})
```

## Signature

`zyzz(nextConfig, options?)`

## Parameters

### nextConfig

- Type: `NextConfig | Promise<NextConfig> | zyzz.Factory`
- Required: Yes; pass `{}` for an otherwise empty configuration.

Existing application configuration. Options and build hooks/rules are preserved. A factory receives the Next.js phase and `{ defaultConfig }`, returning an object or promise. Function configurations are wrapped in an async factory.

```ts
zyzz({ reactStrictMode: true })
```

### options.reset

- Type: `boolean`
- Default: `false`

Include the packaged CSS reset through Webpack or Turbopack CSS delivery. The `reset` layer precedes authored layers. No explicit stylesheet import is needed.

```ts
export default zyzz({ reactStrictMode: true }, { reset: true })
```

## Returns

### nextConfig

- Type: `NextConfig`, `Promise<NextConfig>`, or `zyzz.Factory`, matching the input overload.

Configuration with Zyzz integration attached. It is exported from `next.config.ts`; it does not provide the application's `style` or theme helpers.

```ts
export default zyzz({})
```

## Incremental Compilation

Source, style, and shared-CSS requests reuse one incremental graph per project, bundler, and reset setting within each loader worker. Unchanged file contents, syntax, and directory listings are retained. Edits recompile affected modules and dependents, while added and deleted files refresh graph membership.

Resolution still uses the active bundler so aliases, package conditions, and dependency notifications remain current. Caches live for the worker process and are not shared across Turbopack workers.

## Errors

Compilation and resolution failures are reported through the active bundler. Source diagnostics retain their source locations. Correcting a source error triggers recompilation. File-system errors while creating `.zyzz/next` are thrown during configuration.

The wrapper requires no separate Babel or PostCSS setup. Underlying loaders or transforms remain internal choices, validated separately for Webpack and Turbopack.

See [Next.js Setup](../../introduction/next.md) and the [entrypoint overview](README.md).
