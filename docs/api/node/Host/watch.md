# Host.watch

Watch source and installed dependency changes and report rebuilds or failures.

Package directories, export maps, resolved entries, and adjacent contracts trigger rebuilds. Path polling supplements filesystem events to recover after package removal, atomic replacement, and symlink changes. Successful builds drop unused subscriptions, while failed builds retain subscriptions for recovery.

A missing previously loaded contract is an error. Failed builds retain the last successful artifacts. Closing the host stops source and dependency subscriptions.

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
