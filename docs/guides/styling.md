# Styling

Define, reuse, compose, and bind component styles. Begin with [Getting Started](../introduction/getting-started.md) to connect compilation.

## Recipes

### Style Components

Complete [Getting Started](../introduction/getting-started.md) to connect compilation. Group related `css` and `variants` definitions in `namespace styles {}` with exported `const` members. Earlier declarations can be reused directly within the namespace.

#### Reuse Styles

```tsx
import { css } from 'zyzz'

namespace styles {
  export const button = css({ padding: '1rem' })
}

const example = (
  <>
    <button {...styles.button()}>Save</button>
    <button {...styles.button({ style: { padding: '2rem' } })}>Continue</button>
  </>
)
```

Pass `className` and `style` overrides to the styling function. Keep events, children, and accessibility props on the component. External classes follow the CSS cascade; class-string order does not establish precedence.

#### Add Hover and Responsive Styles

```ts
import { css } from 'zyzz'

namespace styles {
  export const card = css({
    padding: '1rem',
    ':hover': { opacity: 0.8 },
    '@media (min-width: 48rem)': { padding: '2rem' },
  })
}
```

Nest pseudo styles and queries inside a definition. Nested conditions combine with AND. See [relationships](conditions.md#style-relationships) for styling based on other elements.

Use [Dynamic Values](styling.md#dynamic-values) for typed per-instance bindings.

### Share Styles

Keep exported definitions in an ordinary source module and import them where needed. Config remains an explicit dependency.

```ts
import { css } from './zyzz.config.js'

// button.styles.ts

export namespace styles {
  export const button = css({ padding: 'md' })
}
```

```tsx
// Button.tsx
import { styles } from './button.styles.js'

export function Button() {
  return <button {...styles.button()}>Save</button>
}
```

The bundler integration resolves and transforms imports of compiled `css(...)` definitions. Consumers never import generated component copies. For precompiled packages, follow [Publish Libraries](compilation.md#publish-libraries).

> [!NOTE]
> Imported arbitrary object records passed into a separate `css(record)` call remain preview.

### Override Styles

Pass styling overrides to a definition. Compose generated declarations through `cx` when one generated style must override another.

> [!NOTE]
> `cx` supports compiler-resolved local applications and conditional arguments. Packed definitions and arbitrary external props remain unsupported.

```tsx
import { css, cx } from 'zyzz'

namespace styles {
  export const base = css({ padding: '0.5rem' })

  export const roomy = css({ padding: '1rem' })
}
const example = <button {...cx(styles.base(), styles.roomy())}>Continue</button>
```

Later conflicts win within matching conditions, subject to importance. `cx` preserves owned variables and recipe attributes; incompatible recipe ownership fails. External classes retain normal cascade behavior.

```tsx
const custom = (
  <button {...styles.base({ style: { padding: '2rem' } })}>Save</button>
)
```

Keep events and accessibility props on the component. Multiple JSX spreads replace fields instead of composing styles.

### Dynamic Values

```tsx
import { css } from 'zyzz'

namespace styles {
  export const bar = css((values: { width: `${number}%` }) => ({
    width: values.width,
  }))
}
const example = <div {...styles.bar({ width: '50%' })} />
```

Callbacks use explicitly typed scalar inputs and compile to fixed CSS-variable slots. Local finite aliases and interfaces are supported; rule structure, arbitrary runtime expressions, generic/imported dynamic types, and native output remain outside this boundary. Callbacks bind values without generating CSS. Use `variable()` for independently reusable CSS variables.

```ts
namespace styles {
  export const label = css({
    color: 'black!',
    display: ['block', 'flex'],
  })
}
```

Arrays preserve fallback order; a trailing `!` marks importance.

#### Theme Expressions

```ts
import { css, theme } from './zyzz.config.js'

namespace styles {
  export const panel = css({ width: `calc(100% - ${theme.vars.spacing.md})` })
}
```

Import `{ css, theme }` from the [config module](../concepts.md#configuration) and access `theme.vars` directly. These typed CSS references follow compatible theme scopes. Callbacks remain the API for per-instance inputs; `variable()` declares independent CSS variables.

#### Static Bindings

Module-level and namespace-local `const` literals, object spreads, shorthand properties, and literal member reads can supply styles. Extraction preserves property order and rejects mutable or escaping records. Calls and arbitrary expressions are not evaluated.

```ts
namespace styles {
  const base = { padding: '8px' } as const
  type Values = { width: '10px' | '30px' }

  export const card = css({ ...base, color: 'black' })

  export const bar = css((values: Values) => ({ ...base, width: values.width }))
}
```

Finite local type aliases, interfaces without inheritance, and object intersections describe dynamic inputs. Imported or generic types still require a directly supported local annotation.

### CSS Variables

Use `variable()` for reusable CSS variables. Use `variables` in both definitions and applications: definitions emit static CSS, while applications return inline assignments.

```tsx
import { css, variable } from 'zyzz'

namespace variables {
  export const accent = variable('color')
}

namespace styles {
  export const label = css({
    variables: { [variables.accent]: 'tomato' },
    color: variables.accent,
  })
}

function Label() {
  return (
    <span {...styles.label({ variables: { [variables.accent]: 'blue' } })}>
      Hello
    </span>
  )
}
```

Computed assignment keys lose individual domain information in TypeScript. `.set(value)` preserves it. See [variable](../api/core/variable.md) for registration, inheritance, and imported references.
