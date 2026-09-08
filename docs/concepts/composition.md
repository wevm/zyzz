# Composition and Overrides

> [!NOTE]
> Preview API; not yet implemented.

Use `cx` to compose generated styles with override rules. Multiple JSX spreads replace fields. External classes follow the CSS cascade; their class-string order does not establish precedence.

```tsx
import { css, cx } from 'zyzz'

const compact = css({ padding: '0.5rem' })
const roomy = css({ padding: '1rem' })
const example = <button {...cx(compact(), roomy())}>Save</button>
```

Later generated conflicts win within matching conditions, subject to importance. Owned variable bindings and recipe attributes stay attached. See [Override Styles](../guides/overrides.md).
