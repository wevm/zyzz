# Getting Started

Import bound styling helpers and spread their applied props onto a component. Imports always refer to authored source files.

> [!NOTE]
> Config authoring, package installation, and integrations below describe the planned release. Use the [compiler APIs](../guides/compilation.md#publish-libraries) for the current literal pipeline.

## Install

```sh
pnpm add zyzz
```

## Define Config

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export const { css, theme } = Config.create({
  theme: {
    color: { brand: { dark: '#8cf', light: '#06c' } },
    spacing: { md: '1rem' },
  },
})
```

## Style a Component

```tsx
// Button.tsx
import { css, theme } from './zyzz.config.js'

const styles = {
  button: css({
    backgroundColor: 'brand',
    padding: 'md',
    width: `calc(100% - ${theme.vars.spacing.md})`,
  }),
}

export function Button() {
  return <button {...styles.button()}>Save</button>
}
```

Import `Button` normally. The named helpers retain inferred tokens; compilation supplies executable styles and CSS. For literal values without a theme, import `css` directly from `zyzz`.

## Choose Compilation

- **Bundler:** follow [Vite Setup](vite.md). The plugin transforms source imports and delivers CSS automatically.
- **Next.js:** follow [Next.js Setup](next.md). The wrapper configures source transformation and CSS delivery for the selected bundler.
- **CLI:** follow [CLI Setup](cli.md). The standalone compiler emits modules and CSS for a downstream build or library distribution.

Importing config alone does not compile styles. The CLI is a source-transform path; it cannot make untouched authoring calls executable by emitting CSS alone.

## Continue

1. [Style Components](../guides/styling.md#style-components).
2. [Use Themes](../guides/themes.md#use-themes).
3. [Define Variants](../guides/variants.md#define-variants).
