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

### Container Selection

Container conditions query an ancestor, never the styled element. Three forms share one `css` body.

```tsx
import { css } from './zyzz.config.js'

namespace styles {
  export const panel = css({
    '@container >=card': { gap: 'md' },
    '@container sidebar >=card': { display: 'grid' },
    '@container sidebar (min-width: 30rem)': { padding: 'md' },
  })
}
```

- **Nearest eligible container:** `@container >=card` compiles to `@container (width >= 24rem)`. The browser evaluates it against the nearest ancestor with size containment on the queried axis, whatever its name.
- **Named alias:** `@container sidebar >=card` compiles to `@container sidebar (width >= 24rem)` and selects the nearest ancestor named `sidebar` with eligible containment. The name must appear in `containerNames`.
- **Raw query:** any parenthesized condition passes through unchanged, including names absent from `containerNames`. The source compiler checks the CSS syntax; the browser owns the semantics.

The compiler never adds containment. Declare `containerType: 'inline-size'` or `'size'` on the ancestor for width thresholds, `containerType: 'scroll-state'` for scroll-state conditions, and `containerName` for named queries. Size and scroll-state conditions never match without that containment on an ancestor.

Raw style queries such as `@container style(--theme: dark)` need no containment declaration. Every element is a style-query container under the default `container-type: normal`, so the condition matches the nearest ancestor whose custom property has that value.

Conditions inside `css` nest within the generated class rule in that module's stylesheet. `global` rules, including `@container` grouping and containment declared on ancestor selectors, compile into the shared stylesheet, which loads before module stylesheets. See [Global Styles](stylesheets.md#global-styles).

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

Dynamic callback values use private variables on the styled element. They are supported inside at-rules and same-element pseudo or attribute selectors. Relationship selectors remain available for static declarations.
