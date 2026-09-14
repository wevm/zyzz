# Host.close

Dispose the host and release the exclusive output lock.

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

No parameters. Call on an existing runtime.

## Returns

`Promise<void>`. Completes after watchers stop, queued builds drain, and the exclusive output lock is released. Closing is idempotent.

The `.zyzz.json` manifest and generated artifacts remain owned by the recorded `packageId`. Closing does not transfer ownership: reopening with a different `packageId` still causes the next build to reject that manifest.

## Errors

Filesystem cleanup errors may reject. Disposal should run in a `finally` block.

See [Host](README.md) for related methods and types.
