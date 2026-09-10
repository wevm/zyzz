# Css.layers

> [!NOTE]
> Initial compiler support: direct named imports and module-level literal calls.

Contribute an ordered set of cascade layer names.

```ts
import { Css } from 'zyzz/web'

Css.layers(['reset', 'base', 'components'])
```

## Signature

`Css.layers(names)`

## Parameters

### names

- Type: `readonly string[]`
- Required: Yes.

Static ordered CSS layer names, merged with other project order contributions.

```ts
Css.layers(['reset', 'base', 'components'])
```

## Returns

Contributes stylesheet order. No layer-reference object is required by the preview contract; a concrete return type remains unspecified.

## Errors

Reject invalid names and contradictory order cycles with source locations.

Bound `@layer` inference derives from config, not ambient global declarations. Normal and important CSS layer precedence remain unchanged.

See [Css](README.md) for related methods and types.

## Current compiler boundary

Direct named imports from `zyzz/web` compile to static stylesheet data. `global`, `fontFace`, and `Css.layers` are eager across supplied graph modules. Vite scans physical project source under its root, excluding generated directories, tests, and dependencies; the standalone host scans its configured source tree. `Graph.compile` returns one `sharedCss` artifact, and the standalone host writes `zyzz.shared.css`, loaded before module stylesheets. Vite imports one shared virtual stylesheet automatically.

Local keyframes use stable module-and-binding names; unused local definitions are omitted and exported names remain live. Imported animation references, source-relative asset relocation, optional reset, and packed contribution metadata remain follow-ups. Contribution URLs currently require root-relative or absolute paths; unsupported relative URLs fail compilation. Shared contribution maps are not yet emitted.
