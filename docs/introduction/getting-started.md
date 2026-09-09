# Getting Started

Import named styling helpers and apply their values through the `style` prop. Imports always refer to authored source files.

> [!NOTE]
> Static style values and config token imports compile through Vite and the source compiler. Next.js, dynamic callbacks, and variants remain previews.

## Install

```sh
pnpm add zyzz
```

## Define Config

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

const config = Config.create({
  theme: {
    color: { brand: { dark: '#8cf', light: '#06c' } },
    spacing: { md: '1rem' },
  },
})

export const style = config.style
export const theme = config.theme
```

## Style a Component

```tsx
// Button.tsx
import { style } from './zyzz.config.js'

const styles = {
  button: style({
    backgroundColor: 'brand',
    padding: 'md',
  }),
}

export function Button() {
  return <button style={styles.button}>Save</button>
}
```

Import `Button` normally. The named `style` export retains inferred tokens; compilation supplies executable styles and CSS. For literal values without a theme, import `style` directly from `zyzz`.

## Choose Compilation

- **Bundler:** follow [Vite Setup](vite.md). The plugin transforms source imports and delivers CSS automatically.
- **Next.js:** follow [Next.js Setup](next.md). The wrapper configures source transformation and CSS delivery for the selected bundler.
- **CLI:** follow [CLI Setup](cli.md). The standalone compiler emits modules and CSS for a downstream build or library distribution.

Importing config alone does not compile styles. The CLI is a source-transform path; it cannot make untouched authoring calls executable by emitting CSS alone.

## Continue

1. [Style Components](../guides/styling.md#style-components).
2. [Use Themes](../guides/themes.md#use-themes).
3. [Define Variants](../guides/variants.md#define-variants).
