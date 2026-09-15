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

Complete artifact paths relative to output. Every build with styled modules includes `zyzz.css` and its map: shared contributions followed by each module stylesheet with dependencies before their consumers. Trees with configurations include `zyzz.js` when the script path stays inside the output directory. Exported themes and authoring aliases also produce `<source>.zyzz.json` metadata. When lowering TypeScript for publication, copy this sidecar beside its JavaScript entrypoint (for example, `theme.js.zyzz.json`). Ownership manifests are excluded.

```ts
result.files
```

## Errors

The host links source modules together. A source edit recompiles the graph so theme changes reach every consumer; an unchanged graph reuses its compiled output. Missing or invalid dependencies preserve the last successful artifacts.

Build or filesystem failures reject. Failed compilation preserves the previous successful output.

See [Host](README.md) for related methods and types.
