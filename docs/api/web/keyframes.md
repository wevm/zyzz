# keyframes

> [!NOTE]
> Initial compiler support: direct named imports and module-level literal calls.

Define an animation with a stable typed name reference.

```ts
import { keyframes } from 'zyzz/web'

const enter = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
```

## Signature

`keyframes(definition)`

## Parameters

### definition

- Type: Frame-stop map of declarations
- Required: Yes.

Stops accept from, to, 0–100% positions, or valid comma-separated stops. Overlapping stops preserve authored order.

```ts
keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
```

## Returns

### name

- Type: Typed animationName reference

Reachable definitions preserve stable imported identity.

```ts
const styles = {
  notice: css({ animationName: enter }),
}
```

## Errors

Reject important declarations, nested selectors/queries, invalid stops, and unsupported targets.

See [Fonts and Motion](../../guides/stylesheets.md#fonts-and-motion) and [Global Styles](../../guides/stylesheets.md#global-styles).

## Current compiler boundary

Direct named imports from `zyzz/web` compile to static stylesheet data. `global`, `fontFace`, and `Css.layers` are eager across supplied graph modules. Vite scans physical project source under its root, excluding generated directories, tests, and dependencies; the standalone host scans its configured source tree. `Graph.compile` returns one `sharedCss` artifact, and the standalone host writes `zyzz.shared.css`, loaded before module stylesheets. Vite imports one shared virtual stylesheet automatically.

Local keyframes use stable module-and-binding names; unused local definitions are omitted and exported names remain live. Imported animation references, source-relative asset relocation, optional reset, and packed contribution metadata remain follow-ups. Contribution URLs currently require root-relative or absolute paths; unsupported relative URLs fail compilation. Shared contribution maps are not yet emitted.
