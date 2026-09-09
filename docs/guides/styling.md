# Styling

Define, reuse, compose, and bind component styles. Begin with [Getting Started](../introduction/getting-started.md) to connect compilation.

## Recipes

### Style Components

Complete [Getting Started](../introduction/getting-started.md) to connect compilation. Define styles once and apply them wherever needed.

#### Reuse Styles

```tsx
import { style } from 'zyzz'

const styles = {
  button: style({ padding: '1rem' }),
}

const example = (
  <>
    <button style={styles.button}>Save</button>
    <button style={{ ...styles.button, padding: '2rem' }}>Continue</button>
  </>
)
```

Put `className` on the element. Spread one compiled value into an inline style object for per-instance overrides. Keep events, children, and accessibility props on the component. External classes follow the CSS cascade; class-string order does not establish precedence.

#### Add Hover and Responsive Styles

> [!NOTE]
> Conditions are not yet implemented.

```ts
import { style } from 'zyzz'

const styles = {
  card: style({
    padding: '1rem',
    ':hover': { opacity: 0.8 },
    '@media (min-width: 48rem)': { padding: '2rem' },
  }),
}
```

Nest pseudo styles and queries inside a definition. Nested conditions combine with AND. See [relationships](conditions.md#style-relationships) for styling based on other elements.

Use [Dynamic Values](styling.md#dynamic-values) for typed per-instance bindings.

### Share Styles

Keep exported definitions in an ordinary source module and import them where needed. Config remains an explicit dependency.

```ts
import { style } from './zyzz.config.js'

// button.styles.ts

export const styles = { button: style({ padding: 'md' }) }
```

```tsx
// Button.tsx
import { styles } from './button.styles.js'

export function Button() {
  return <button style={styles.button}>Save</button>
}
```

The bundler integration resolves and transforms source imports. Consumers never import generated component copies. For precompiled packages, follow [Publish Libraries](compilation.md#publish-libraries).

### Override Styles

Spread one compiled value into a native inline style object. Compose generated declarations through `cx` when one generated style must override another.

> [!NOTE]
> `cx` composition is not yet implemented. Native inline overrides are supported through `style={{ ...styles.button, opacity: 0.5 }}`.

```tsx
import { style, cx } from 'zyzz'

const styles = {
  base: style({ padding: '0.5rem' }),

  roomy: style({ padding: '1rem' }),
}
const example = <button style={cx(styles.base, styles.roomy)}>Continue</button>
```

Later conflicts win within matching conditions, subject to importance. `cx` preserves owned variables and recipe attributes; incompatible recipe ownership fails. External classes retain normal cascade behavior.

```tsx
const custom = <button style={{ ...styles.base, padding: '2rem' }}>Save</button>
```

Keep events and accessibility props on the component. Multiple JSX spreads replace fields instead of composing styles.

### Dynamic Values

> [!NOTE]
> Preview API; not yet implemented.

```tsx
import { style } from 'zyzz'

const styles = {
  bar: style((values: { width: `${number}%` }) => ({
    width: values.width,
  })),
}
const example = <div style={styles.bar({ width: '50%' })} />
```

Callbacks bind values without generating CSS. Use `Vars` only when a shared variable contract is needed.

```ts
const styles = {
  label: style({
    color: 'black!',
    display: ['block', 'flex'],
  }),
}
```

Arrays preserve fallback order; a trailing `!` marks importance.

#### Theme Expressions

```ts
import { style, theme } from './zyzz.config.js'

const styles = {
  panel: style({ width: `calc(100% - ${theme.vars.spacing.md})` }),
}
```

Import `{ theme }` from the [config module](../concepts.md#configuration) to access `theme.vars`. These typed CSS references follow compatible theme scopes. Callbacks remain the API for per-instance inputs; `Vars` defines independent shared contracts.

### Forward Styles

Custom components retain opaque style values. Forward the `style` prop or the complete props object to an intrinsic element processed by Zyzz:

```tsx
import type { ComponentProps } from 'react'

export function Button(props: ComponentProps<'button'>) {
  return <button {...props} />
}
```

The intrinsic boundary merges generated classes with `className` and keeps inline overrides. It evaluates attributes once in authored order. Ordinary inline styles keep their native behavior. Components containing the receiving DOM element must pass through the Zyzz compiler.

For an uncompiled third-party component that forwards DOM props, resolve the value explicitly in an adapter:

```tsx
import { Style } from 'zyzz/runtime'

const example = <ExternalButton {...Style.resolve({ style: styles.button })} />
```
