# Style States

> [!NOTE]
> Preview API; not yet implemented.

Use pseudo styles for browser state and data attributes for application state. Keep accessibility attributes on the real control.

```tsx
import { css } from 'zyzz'

const button = css({
  ':disabled': { opacity: 0.5 },
  ':focus-visible': { outline: '2px solid currentColor' },
  ':hover': { opacity: 0.8 },
  '&[data-state="open"]': { backgroundColor: '#eee' },
})
const example = (
  <button {...button()} aria-expanded={true} data-state="open">
    Details
  </button>
)
```

Do not concatenate classes to establish override priority. See [Style Relationships](relationships.md) when state belongs to another element.
