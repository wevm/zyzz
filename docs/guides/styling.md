# Style Components

Complete [Getting Started](../introduction/getting-started.md) to connect compilation. Define styles once and apply them wherever needed.

## Reuse Styles

```tsx
import { css } from 'zyzz'

const button = css({ padding: '1rem' })

const example = (
  <>
    <button {...button()}>Save</button>
    <button {...button({ style: { padding: '2rem' } })}>Continue</button>
  </>
)
```

Pass `className` and `style` overrides to the styling function. Keep events, children, and accessibility props on the component. External classes follow the CSS cascade; class-string order does not establish precedence.

## Add Hover and Responsive Styles

> [!NOTE]
> Conditions are not yet implemented.

```ts
import { css } from 'zyzz'

const card = css({
  padding: '1rem',
  ':hover': { opacity: 0.8 },
  '@media (min-width: 48rem)': { padding: '2rem' },
})
```

Nest pseudo styles and queries inside a definition. Nested conditions combine with AND. See [relationships](relationships.md) for styling based on other elements.

Use [Dynamic Values](dynamic-values.md) for typed per-instance bindings.
