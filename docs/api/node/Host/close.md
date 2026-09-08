# Host.close

Dispose the host and release output ownership.

```ts
import { Host } from 'zyzz/node'

const host = await Host.create({
  outDir: 'dist',
  packageId: 'app',
  root: 'src',
})
await host.close()
```

## Signature

`await host.close()`

## Parameters

No parameters; call on an existing runtime.

## Returns

`Promise<void>`. Completes after watchers stop, queued builds drain, and ownership is released. Closing is idempotent.

## Errors

Filesystem cleanup errors may reject; disposal should run in a `finally` block.

See [Host](README.md) for related methods and types.
