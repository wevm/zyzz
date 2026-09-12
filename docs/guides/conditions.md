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

`where` templates interpolate `css()` definitions without calling them. `&` selects the styled element; combinators, pseudo-classes, attributes, and `:has()` retain ordinary CSS semantics. Apply the referenced definition through its normal style props. An empty `css({})` supplies identity without declarations.

```ts
import { css, where } from 'zyzz'

namespace styles {
  export const card = css({})
  export const label = css({
    [where`${card}:hover &`]: { color: 'blue' },
    [where`${card}[data-state="open"] > &`]: { opacity: 1 },
    [where`${card} > &:nth-child(even)`]: { opacity: 0.5 },
  })
}
```

References retain their identity through local aliases, namespace members, named imports/re-exports, and packed libraries. Selector grammar is checked during compilation. TypeScript checks interpolation identities and nested declaration values; it does not validate selector text or prove DOM structure.

Specificity follows the authored selector. Use explicit `:where(...)` to lower condition specificity. Application-owned state remains in ordinary data/ARIA attributes. No runtime selector parsing, DOM lookup, or CSS generation is involved.

Dynamic callback values require same-element selectors because their private variables live on the styled element.
