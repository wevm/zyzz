# keyframes

> [!NOTE]
> Initial compiler support: direct named imports and module-level literal calls.

Define an animation with a stable typed name reference.

```ts
import { keyframes } from 'zyzz/web'

const enter = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
```

## Signature

`keyframes(definition, context = {})`

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
namespace styles {
  export const notice = css({ animationName: enter })
}
```

## Errors

Reject important declarations, nested selectors/queries, invalid stops, and unsupported targets.

See [Fonts and Motion](../../guides/stylesheets.md#fonts-and-motion) and [Global Styles](../../guides/stylesheets.md#global-styles).

## Current compiler boundary

Direct named imports from `zyzz/web` compile to static stylesheet data. `global`, `fontFace`, and `layers` are eager across supplied graph modules. Vite scans physical project source under its root, excluding generated directories, tests, and dependencies. The standalone host scans its configured source tree. `Graph.compile` returns one `sharedCss` artifact, and the standalone host writes `zyzz.shared.css`, loaded before module stylesheets. Vite imports one shared virtual stylesheet automatically.

Local keyframes use stable module-and-binding names. Unused local definitions are omitted and exported names remain live. Imported and re-exported animations retain their identity through packed metadata. Relative URLs resolve against the contributing source. Node publishes assets and Vite handles their production URLs. Shared CSS includes source maps and packed contributions. Opt into the reset with `import 'zyzz/reset.css'`.

## Enclosing contexts

`context.within` is an optional ordered list of conditional or layer headers, outermost first. Omission or explicit `undefined` uses stylesheet scope. Anonymous `@layer` groups are supported.

```ts
const fade = keyframes(
  { 'entry 0%': { opacity: 0 }, 'exit 100%': { opacity: 1 } },
  { within: ['@layer animations'] },
)
```

Named timeline ranges include `contain`, `cover`, `entry`, `entry-crossing`, `exit`, and `exit-crossing`, each followed by a percentage.
