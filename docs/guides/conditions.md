# Conditions

Respond to viewport size, browser state, and related elements. Begin with [Getting Started](../introduction/getting-started.md) to connect compilation.

## Recipes

### Responsive Styles

Define typed thresholds in config, then reference them in media and container conditions.

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export const { css, theme } = Config.create({
  theme: {
    breakpoints: { tablet: '48rem' },
    containerNames: ['sidebar'],
    containers: { card: '24rem' },
    spacing: { md: '1rem', sm: '0.5rem' },
  },
})
```

```tsx
import { css } from './zyzz.config.js'

namespace styles {
  export const region = css({
    containerName: 'sidebar',
    containerType: 'inline-size',
  })

  export const content = css({
    padding: 'sm',
    '@container sidebar >=card': { display: 'grid' },
    '@media tablet': { padding: 'md' },
  })
}
const example = (
  <aside {...styles.region()}>
    <div {...styles.content()}>Content</div>
  </aside>
)
```

Media thresholds measure the viewport; container thresholds measure the eligible ancestor. Aliases compile to literals, so switching theme scopes does not change them. Raw CSS queries and `@supports` remain supported design paths.

### Style States

Use pseudo styles for browser state and data attributes for application state. Keep accessibility attributes on the real control.

```tsx
import { css } from 'zyzz'

namespace styles {
  export const button = css({
    ':disabled': { opacity: 0.5 },
    ':focus-visible': { outline: '2px solid currentColor' },
    ':hover': { opacity: 0.8 },
    '&[data-state="open"]': { backgroundColor: '#eee' },
  })
}
const example = (
  <button {...styles.button()} aria-expanded={true} data-state="open">
    Details
  </button>
)
```

Do not concatenate classes to establish override priority. See [Style Relationships](conditions.md#style-relationships) when state belongs to another element.

### Style Relationships

Style an element from the state of a related element by interpolating that element's `css` definition into `where`.

Relationship keys compile inside web `css(...)` definitions. Applying a definition is what marks the element; core `Style.define` and global declarations do not accept relationship keys.

```tsx
import { css } from 'zyzz'
import { where } from 'zyzz/web'

namespace styles {
  export const card = css({ padding: 16 })
  export const label = css({
    [where`${card}[aria-expanded="true"] &`]: { opacity: 1 },
  })
}
const example = (
  <section {...styles.card()} aria-expanded={true}>
    <div>
      <span {...styles.label()}>Details</span>
    </div>
  </section>
)
```

This deliberately includes an intermediate element: the descendant combinator matches at any depth, so the card is an ancestor, not the span's immediate parent. Write `${card} > &` for the parent, and `&:has(${card})` to check descendants of the styled element. Combinators describe direction and distance; they do not verify DOM structure through TypeScript.

Selector text follows raw condition key rules, with `&` as the styled element. Definitions lower to their identity class wrapped in `:where()`, so definition predicates add zero specificity. State is selector text: real attributes such as `aria-expanded` or `:checked`, or application-owned `data-*` attributes. Nested keys require several relationships at once.

```tsx
namespace styles {
  export const toggle = css({})
  export const hint = css({
    [where`${toggle}:checked ~ &`]: { color: '#06c' },
    [where`${card}[aria-expanded="true"] &`]: {
      [where`${toggle}:checked ~ &`]: { fontWeight: 600 },
    },
    [where`:root:has(${card}[data-busy]) &`]: { filter: 'blur(2px)' },
  })
}
```

An empty definition such as `toggle` compiles to an identity class alone, which marks an element without styling it. Disjunction uses a selector list with `&` in each selector, or separate keys with the same body. Negate a state while keeping identity: `${card}:not([aria-expanded="true"]) &`. Negating the whole definition compound would also match unmarked ancestors such as `html`.

Dynamic callback values use private variables on the styled element. They are supported inside at-rules and same-element pseudo or attribute selectors. Relationship selectors remain available for static declarations.
