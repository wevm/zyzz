# Host.watch

Watch source changes and report rebuilds or failures.

```ts
import { Host } from 'zyzz/node'

const host = await Host.create({
  outDir: 'dist',
  packageId: 'app',
  root: 'src',
})
host.watch({ onResult: (event) => console.log(event) })
// Keep the host alive while needed; await host.close() during shutdown.
```

## Signature

`host.watch(options)`

## Parameters

`onResult`: receives `Host.Event`, either `{ result }` or `{ error }`; the callback must not throw.

## Returns

No return value. Watching starts with an initial build and remains active until `close`.

## Errors

Build/watch failures are reported through `onResult`. Invalid lifecycle use may throw.

See [Host](README.md) for related methods and types.
