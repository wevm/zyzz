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

Use a typed ref to style an element when an ancestor has a matching data state.

These helpers compile inside web `css(...)` definitions. Use ref callables as ordinary element attributes; core `Style.define` and global declarations do not accept relationship keys.

```tsx
import { css } from 'zyzz'
import { ancestor, ref } from 'zyzz/web'

const card = ref({ state: ['closed', 'open'] })
namespace styles {
  export const label = css({
    [ancestor(card, { state: 'open' })]: { opacity: 1 },
  })
}
const example = (
  <section {...card({ state: 'open' })}>
    <div>
      <span {...styles.label()}>Details</span>
    </div>
  </section>
)
```

This deliberately includes an intermediate element: the ref is an ancestor, not the span's immediate parent. `descendant` checks descendants of the styled element. Helper names describe direction and depth; they do not verify DOM structure through TypeScript.

Predicates on the marked element combine with AND. A pseudo string checks browser state; declared states narrow by data attribute. Nesting relationship keys requires several marked elements at once, and nesting under `:hover` adds the styled element's own state.

```tsx
import { ancestor, ref, siblingBefore } from 'zyzz/web'

const choice = ref()
namespace styles {
  export const hint = css({
    [siblingBefore(choice, ':checked')]: { color: '#06c' },
    [ancestor(card, { state: 'open' })]: {
      [siblingBefore(choice, ':checked')]: { fontWeight: 600 },
    },
  })
}
```

> [!NOTE]
> The accepted contract takes the pseudo as the second argument and declared states as an optional third, pending compiler support: `ancestor(card, ':hover', { state: 'open' })`. The pseudo accepts any same-element pseudo-class chain, including `:not()`, `:nth-child()`, and, for `ancestor` and `siblingBefore`, relative `:has()` lists such as `':focus-within:has(> input:checked)'`. The current implementation takes one condition argument with optional `pseudo` and `has` keys.

Finite state domains express negation by naming the complementary values. Disjunction across different markers uses separate keys with the same body; same-element alternatives use `:is()` inside the pseudo. Referring to a second ref inside `:has()`, and immediate parent, child, or adjacent-sibling distance, remain outside these helpers.

Dynamic callback values use private variables on the styled element. They are supported inside at-rules and same-element pseudo or attribute selectors. Relationship selectors remain available for static declarations.
