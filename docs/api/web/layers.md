# layers

> [!NOTE]
> Initial compiler support: direct named imports and module-level literal calls.

Contribute an ordered set of cascade layer names.

```ts
import { layers } from 'zyzz/web'

layers(['reset', 'base', 'components'])
```

## Signature

`layers(names)`

## Parameters

### names

- Type: `readonly string[]`
- Required: Yes.

Static ordered CSS layer names, merged with other project order contributions. Consecutive names constrain the shared prelude; names without constraints sort by code unit order, independently of call, module, or chunk order.

```ts
layers(['reset', 'base', 'components'])
```

## Returns

`void`. The compiler records the stylesheet order and removes the call.

## Errors

Reject invalid names and contradictory order cycles with source locations.

Bound `@layer` inference derives from config, not ambient global declarations. Normal and important CSS layer precedence remain unchanged. An external stylesheet parsed before the shared prelude fixes its own layer order first; load the compiled stylesheet earlier or match that order.

See [Css](Css/README.md) for related methods and types.

## Current compiler boundary

Direct named imports from `zyzz/web` compile to static stylesheet data. `global`, `fontFace`, and `layers` are eager across supplied graph modules. Vite scans physical project source under its root, excluding generated directories, tests, and dependencies; the standalone host scans its configured source tree. `Graph.compile` returns one `sharedCss` artifact, and the standalone host writes `zyzz.shared.css`, loaded before module stylesheets. Vite imports one shared virtual stylesheet automatically.

Local keyframes use stable module-and-binding names; unused local definitions are omitted and exported names remain live. Imported and re-exported animations retain their identity through packed metadata. Relative URLs resolve against the contributing source; Node publishes assets and Vite handles their production URLs. Shared CSS includes source maps and packed contributions. Opt into the reset with `import 'zyzz/reset.css'`.
