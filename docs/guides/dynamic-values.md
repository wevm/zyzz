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

## Theme Expressions

```ts
import { css, variables } from './zyzz.config.js'

const panel = css({ width: `calc(100% - ${variables.spacing.md})` })
```

Export `variables = theme.vars` from the [config module](../concepts.md#configuration). These typed CSS references follow compatible theme scopes. Callbacks remain the API for per-instance inputs; `Vars` defines independent shared contracts.
