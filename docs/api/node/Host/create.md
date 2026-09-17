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

## Native Output

Set `native` to an explicit compilation context to publish native TypeScript/JavaScript modules and source maps. The host emits no CSS or web initialization script. Native builds require module output and source rewriting.

```ts
await using host = await Host.create({
  native: { colorScheme: 'dark', platform: 'ios' },
  outDir: 'dist-native',
  packageId: 'my-library',
  root: 'src',
})
await host.build()
```

Imported changes rebuild dependent callables. Failed builds retain the last successful artifacts, and watch mode resumes after corrected source. Platform and scheme are fixed for the lifecycle. Create a separate host and output directory for another context.

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

### options.native

- Type: `Host.create.Options['native']`
- Default: `undefined`, which emits web output.

Compile native modules and source maps without CSS or web initialization. Requires `compiler` and `modules` to remain enabled. The host snapshots the context and its mapping objects at creation. Caller mutations do not change subsequent builds. Theme definitions are immutable values created by `Theme.define` or `Theme.extend`.

```ts
await using host = await Host.create({
  native: {
    colorScheme: 'dark',
    fonts: { 'Inter, sans-serif': 'Inter-Regular' },
    platform: 'ios',
    units: { rem: 16 },
  },
  outDir: 'dist-native',
  packageId: 'my-library',
  root: 'src',
})
await host.build()
```

### options.native.colorScheme

- Type: `'dark' | 'light'`
- Required: Yes.

Select the scheme compiled into native callables. No device scheme is read.

```ts
native: {
  colorScheme: 'dark'
}
```

### options.native.fonts

- Type: `Readonly<Record<string, string>>`
- Default: No font mappings.

Map exact authored `fontFamily` text to an installed native font family. Font installation remains the application's responsibility.

```ts
native: { colorScheme: 'light', fonts: { 'Inter, sans-serif': 'Inter-Regular' } }
```

### options.native.platform

- Type: `'android' | 'ios'`
- Default: `undefined`

Select platform overrides. Required when authored styles contain platform branches.

```ts
native: { colorScheme: 'light', platform: 'android' }
```

### options.native.theme

- Type: `string`
- Default: `'default'`

Select a label from `themes`. The label must exist in the compiled tables. Without `themes`, the default table uses authored token fallbacks.

```ts
native: { colorScheme: 'light', theme: 'brand', themes: { brand } }
```

### options.native.themes

- Type: `Readonly<Record<string, Theme.Definition>>`
- Default: A default table using authored token fallbacks.

Supply immutable theme definitions keyed by output label. Select a label with `theme`.

```ts
import { Theme } from 'zyzz'
import { Host } from 'zyzz/node'

const brand = Theme.define({ color: { ink: '#123456' } })

await using host = await Host.create({
  native: { colorScheme: 'light', theme: 'brand', themes: { brand } },
  outDir: 'dist-native',
  packageId: 'my-library',
  root: 'src',
})
```

### options.native.units

- Type: `{ readonly px?: number; readonly rem?: number }`
- Default: `px` is `1`. `rem` has no default.

Set positive logical-unit conversion scales. Authored `rem` lengths require an explicit `rem` scale.

```ts
native: { colorScheme: 'light', units: { px: 1, rem: 16 } }
```

### options.outDir

- Type: `string`
- Default: `dist`

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

### options.script

- Type: `string | false`
- Default: `zyzz.js` inside `outDir`

Path of the initialization script that restores the theme and scheme saved by every `Config.create` in the tree, exported or kept local to its module. Inside the output directory it is an owned artifact listed in build results. A path elsewhere, such as a bundler's public directory, is rewritten in place when its content changes and removed when no configuration remains; the host recognizes its own output by the leading `/* zyzz initialization */` comment and refuses to replace any other file at that path. The path must not be inside `root`. `false` disables the script.

```ts
Host.create({ packageId: 'app', root: 'src', script: 'public/zyzz.js' })
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
