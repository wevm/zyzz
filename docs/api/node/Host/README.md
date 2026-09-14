# Host

Filesystem builds, Lightning CSS processing, ownership, and watching.

```ts
import { Host } from 'zyzz/node'
```

## Methods

| API                      | Description                                                |
| ------------------------ | ---------------------------------------------------------- |
| [Host.build](build.md)   | Build the host source tree and publish owned artifacts.    |
| [Host.close](close.md)   | Dispose the host and release the exclusive output lock.    |
| [Host.create](create.md) | Create a file-build lifecycle around the source transform. |
| [Host.watch](watch.md)   | Watch source changes and report rebuilds or failures.      |

## Types and Errors

`Build`, `Event`, and `Runtime`, plus `create.Options` and `watch.Options`. Build/close/watch are returned runtime methods, not standalone module functions.

See the [public declarations](../../../../src/node/Host.ts) for complete generic signatures and documented type properties.
