# Host.create

Create a file-build lifecycle around the source transform.

```ts
import { Host } from 'zyzz/node'

const host = await Host.create({
  outDir: 'dist',
  packageId: 'my-library',
  root: 'src',
})
try {
  await host.build()
} finally {
  await host.close()
}
```

## Signature

`await Host.create(options)`

## Parameters

### options.outDir

- Type: `string`
- Required: Yes.

Output directory exclusively owned until disposal.

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

### build

- Type: `() => Promise<Host.Build>`

Build and publish owned artifacts. See [build](build.md) for the result properties.

```ts
await host.build()
```

### close

- Type: `() => Promise<void>`

Stop watchers, drain queued builds, and release output ownership. Closing is idempotent.

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

Filesystem, ownership, and input errors reject. Build diagnostics remain source/compiler errors; no new Host error class is promised.

See [Host](README.md) for related methods and types.
