# Override Styles

Pass styling overrides to a definition. Compose generated declarations through `cx` when one generated style must override another.

> [!NOTE]
> `cx` composition is not yet implemented. Literal `className`/`style` overrides already exist on transformed definitions.

```tsx
import { css, cx } from 'zyzz'

const base = css({ padding: '0.5rem' })
const roomy = css({ padding: '1rem' })
const example = <button {...cx(base(), roomy())}>Continue</button>
```

Later conflicts win within matching conditions, subject to importance. `cx` preserves owned variables and recipe attributes; incompatible recipe ownership fails. External classes retain normal cascade behavior.

```tsx
const custom = <button {...base({ style: { padding: '2rem' } })}>Save</button>
```

Keep events and accessibility props on the component. Multiple JSX spreads replace fields instead of composing styles.
