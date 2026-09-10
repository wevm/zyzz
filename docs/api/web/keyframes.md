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
