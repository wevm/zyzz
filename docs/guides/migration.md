# Migration

Migrate one component and its computed styles at a time. Preserve layout, states, theme behavior, and CSS delivery before expanding adoption.

| Existing Approach        | Zyzz Authoring                         |
| ------------------------ | -------------------------------------- |
| Utility strings          | Typed properties in `css` definitions  |
| Theme-specific utilities | Config-bound token names               |
| Variant helpers          | Bound `variants` choices and compounds |
| Runtime style factories  | Typed value callbacks with fixed rules |

```tsx
import { css } from 'zyzz'

const card = css({ padding: '1rem' })
const example = <div {...card()}>Card</div>
```

External CSS remains subject to its authored specificity and layers. Do not assume previous class-order overrides or component wrappers translate automatically. Use the [comparison](../introduction/comparisons.md) and [compatibility inventory](../introduction/compatibility.md) to identify unsupported cases.
