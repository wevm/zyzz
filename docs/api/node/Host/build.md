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

Returns `Promise<Host.Build>`. The properties below belong to the resolved build result.

### changed

- Type: `readonly string[]`

Changed artifact paths relative to the output directory.

```ts
result.changed
```

### files

- Type: `readonly string[]`

Complete artifact paths relative to output. Ownership manifests are excluded.

```ts
result.files
```

## Errors

Build or filesystem failures reject. Failed compilation preserves the previous successful output.

See [Host](README.md) for related methods and types.
