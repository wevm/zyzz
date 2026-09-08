# Host.build

Build the host source tree and publish owned artifacts.

```ts
import { Host } from 'zyzz/node'

const host = await Host.create({
  outDir: 'dist',
  packageId: 'app',
  root: 'src',
})
try {
  const result = await host.build()
} finally {
  await host.close()
}
```

## Signature

`await host.build()`

## Parameters

No parameters; call on a runtime from `Host.create`.

## Returns

A promise of `Host.Build`: `changed` and complete `files`, relative to output. Ownership manifests are excluded.

## Errors

Build or filesystem failures reject. Failed compilation preserves the previous successful output.

See [Host](README.md) for related methods and types.
