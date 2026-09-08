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

### options.onResult

- Type: `(event: Host.Event) => void`
- Required: Yes.

Receives either `{ result }` or `{ error }`. The callback must not throw.

```ts
host.watch({
  onResult: (event) => {
    if ('error' in event) console.error(event.error)
    else console.log(event.result.files)
  },
})
```

## Returns

`void`. Watching starts with an initial build and remains active until `close`.

## Errors

Build/watch failures are reported through `onResult`. Invalid lifecycle use may throw.

See [Host](README.md) for related methods and types.
