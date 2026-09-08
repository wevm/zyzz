# Styling

Define, reuse, compose, and bind component styles. Begin with [Getting Started](../introduction/getting-started.md) to connect compilation.

## Recipes

### Style Components

Complete [Getting Started](../introduction/getting-started.md) to connect compilation. Define styles once and apply them wherever needed.

#### Reuse Styles

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

#### Add Hover and Responsive Styles

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

Nest pseudo styles and queries inside a definition. Nested conditions combine with AND. See [relationships](conditions.md#style-relationships) for styling based on other elements.

Use [Dynamic Values](styling.md#dynamic-values) for typed per-instance bindings.

### Share Styles

> [!NOTE]
> Preview API; not yet implemented.

Keep exported definitions in an ordinary source module and import them where needed. Config remains an explicit dependency.

```ts
import { zyzz } from './zyzz.config.js'

// button.styles.ts

export const button = zyzz.css({ padding: 'md' })
```

```tsx
// Button.tsx
import { button } from './button.styles.js'

export function Button() {
  return <button {...button()}>Save</button>
}
```

The bundler integration resolves and transforms source imports. Consumers never import generated component copies. For precompiled packages, follow [Publish Libraries](compilation.md#publish-libraries).

### Override Styles

Pass styling overrides to a definition. Compose generated declarations through `cx` when one generated style must override another.

> [!NOTE]
> `cx` composition is not yet implemented. Literal `className`/`style` overrides already exist on transformed definitions.

```tsx
import { css, cx } from 'zyzz'

const base = css({ padding: '0.5rem' })
const roomy = css({ padding: '1rem' })
const example = <button {...cx(base(), roomy())}>Continue</button>
```

Later conflicts win within matching conditions, subject to importance. `cx` preserves owned variables and recipe attributes; incompatible recipe ownership fails. External classes retain normal cascade behavior.

```tsx
const custom = <button {...base({ style: { padding: '2rem' } })}>Save</button>
```

Keep events and accessibility props on the component. Multiple JSX spreads replace fields instead of composing styles.

### Dynamic Values

> [!NOTE]
> Preview API; not yet implemented.

```tsx
import { css } from 'zyzz'

const bar = css((values: { width: `${number}%` }) => ({
  width: values.width,
}))
const example = <div {...bar({ width: '50%' })} />
```

Callbacks bind values without generating CSS. Use `Vars` only when a shared variable contract is needed.

```ts
const label = css({
  color: 'black!',
  display: ['block', 'flex'],
})
```

Arrays preserve fallback order; a trailing `!` marks importance.

#### Theme Expressions

```ts
import { zyzz } from './zyzz.config.js'

const panel = zyzz.css({ width: `calc(100% - ${zyzz.theme.vars.spacing.md})` })
```

Import `{ zyzz }` from the [config module](../concepts.md#configuration) and access `zyzz.theme.vars` directly. These typed CSS references follow compatible theme scopes. Callbacks remain the API for per-instance inputs; `Vars` defines independent shared contracts.
