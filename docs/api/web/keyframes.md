# keyframes

> [!NOTE]
> Preview API; not yet implemented.

Define an animation with a stable typed name reference.

```ts
import { keyframes } from 'zyzz/web'

const enter = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
```

## Signature

`keyframes(definition)`

## Parameters

Frame stops: `from`, `to`, 0–100% positions, or valid comma-separated stops. Bodies contain declarations; overlapping stops preserve authored order.

## Returns

A typed `animationName` reference. Reachable definitions preserve stable imported identity.

## Errors

Reject important declarations, nested selectors/queries, invalid stops, and unsupported targets.

See [Fonts and Motion](../../guides/motion.md) and [Global Styles](../../guides/stylesheets.md).
