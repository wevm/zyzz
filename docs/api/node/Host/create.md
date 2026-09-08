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

- `outDir`: exclusively owned output directory until disposal.
- `packageId`: stable prefix for relative source identities.
- `root`: scanned source directory.

## Returns

A promise resolving to `Host.Runtime` with `build`, `close`, and `watch`.

## Errors

Filesystem, ownership, and input errors reject. Build diagnostics remain source/compiler errors; no new Host error class is promised.

See [Host](README.md) for related methods and types.
