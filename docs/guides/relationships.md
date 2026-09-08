# Style Relationships

Use a typed marker to style an element when an ancestor has a matching data state.

> [!NOTE]
> Preview API; not yet implemented.

```tsx
import { css } from 'zyzz'
import { Css } from 'zyzz/web'

const card = Css.marker({ state: ['closed', 'open'] })
const label = css({
  [Css.ancestor(card, { data: { state: 'open' } })]: { opacity: 1 },
})
const example = (
  <section {...card({ state: 'open' })}>
    <div>
      <span {...label()}>Details</span>
    </div>
  </section>
)
```

This deliberately includes an intermediate element: the marker is an ancestor, not the span's immediate parent. `Css.descendant` checks descendants of the styled element. Helper names describe direction and depth; they do not verify DOM structure through TypeScript.
