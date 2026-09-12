# Host.create

Create a file-build lifecycle with Lightning CSS processing and source maps back to authored TypeScript.

```ts
import { Host } from 'zyzz/node'

await using host = await Host.create({
  css: { minify: true, targets: { safari: 15 << 16 } },
  outDir: 'dist',
  packageId: 'my-library',
  root: 'src',
})
await host.build()
```

## Signature

`await Host.create(options)`

## Parameters

### options.css

- Type: `false | { minify?: boolean; targets?: Readonly<LightningCss.Targets> }`
- Default: `{ minify: false }`

Process emitted stylesheets with Lightning CSS. Set `false` to preserve intermediate CSS for another processor. Options are captured when the lifecycle is created. Source maps are composed in both formatted and minified output; JavaScript output is unchanged.

```ts
Host.create({
  css: false,
  outDir: 'dist',
  packageId: 'my-library',
  root: 'src',
})
```

### options.css.minify

- Type: `boolean`
- Default: `false`

Minify each emitted stylesheet.

```ts
css: {
  minify: true
}
```

### options.css.targets

- Type: `Readonly<LightningCss.Targets>`
- Default: No browser targets.

Explicit browser versions control compatibility transforms and prefixing. Versions use `(major << 16) | (minor << 8) | patch`. No Browserslist configuration is discovered automatically. Targets transform supported CSS syntax; they do not polyfill unsupported browser features.

```ts
css: { targets: { chrome: 100 << 16, safari: (15 << 16) | (4 << 8) } }
```

### options.outDir

- Type: `string`
- Required: Yes.

Output directory exclusively locked until disposal. The ownership manifest persists after close; its recorded package identity is not transferred.

```ts
Host.create({ outDir: 'dist', packageId: 'my-library', root: 'src' })
```

### options.packageId

- Type: `string`
- Required: Yes.

Stable prefix for relative source identities.

```ts
Host.create({ outDir: 'dist', packageId: 'my-library', root: 'src' })
```

### options.root

- Type: `string`
- Required: Yes.

Source directory scanned by the host.

```ts
Host.create({ outDir: 'dist', packageId: 'my-library', root: 'src' })
```

## Returns

Returns `Promise<Host.Runtime>`. Await creation before calling the returned operations.

### Symbol.asyncDispose

- Type: `() => Promise<void>`

Runs the same cleanup as `close` when an `await using` scope exits, including after an error. Stops watchers, drains pending builds, and releases the output lock. Keep watch scopes alive for the intended watch lifetime.

```ts
await using host = await Host.create({
  outDir: 'dist',
  packageId: 'my-library',
  root: 'src',
})
await host.build()
```

### build

- Type: `() => Promise<Host.Build>`

Build and publish owned artifacts. See [build](build.md) for the result properties.

```ts
await host.build()
```

### close

- Type: `() => Promise<void>`

Stop watchers, drain queued builds, and release the exclusive output lock. Closing is idempotent.

```ts
await host.close()
```

### watch

- Type: `(options: Host.watch.Options) => void`

Start an initial build and report subsequent rebuilds or failures until close.

```ts
host.watch({ onResult: (event) => console.log(event) })
```

## Errors

Filesystem, ownership, input, and Lightning CSS errors reject. CSS processing completes before publication; failed builds retain the last successful artifacts. No new Host error class is promised.

See [Host](README.md) for related methods and types.
