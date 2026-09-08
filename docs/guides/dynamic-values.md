# Dynamic Values

> [!NOTE]
> Preview API; not yet implemented.

```tsx
import { css } from 'zyzz'

const bar = css((values: { width: `${number}%` }) => ({
  width: values.width,
}))
const example = <div {...bar({ width: '50%' })} />
```

Callbacks bind values without generating CSS. Use `Vars` only when a shared variable contract is needed.

```ts
const label = css({
  color: 'black!',
  display: ['block', 'flex'],
})
```

Arrays preserve fallback order; a trailing `!` marks importance.
