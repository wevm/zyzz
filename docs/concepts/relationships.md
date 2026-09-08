# Relationships

> [!NOTE]
> Preview API; not yet implemented.

Typed markers describe element identity and finite data states. Applying a marker emits attributes; another definition can reference that identity.

```ts
import { Css } from 'zyzz/web'

const card = Css.marker({ state: ['closed', 'open'] })
const condition = Css.ancestor(card, { data: { state: 'open' } })
```

- **Depth:** ancestor/descendant helpers match at any depth; immediate parent/child helpers remain undecided.
- **Matching:** repeated markers use any qualifying ancestor, not nearest-boundary behavior.
- **Predicates:** combined predicates must match the same marked element.
- **Specificity:** helpers add zero condition specificity; raw selectors retain their own.
- **Types:** constrain marker values, not DOM structure or accessibility semantics.

See [Style Relationships](../guides/relationships.md) for application and [Css](../api/web/Css/README.md) for sibling directions.
