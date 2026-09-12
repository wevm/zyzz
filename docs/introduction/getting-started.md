# Getting Started

Import bound styling helpers and spread their applied props onto a component. Imports always refer to authored source files.

> [!NOTE]
> The Config, Vite, and Next.js source workflows are implemented. The CLI and native integrations retain separate implementation gates. Custom hosts can use the [compiler APIs](../guides/compilation.md#publish-libraries).

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

namespace styles {
  export const button = css({
    backgroundColor: 'brand',
    padding: 'md',
    width: `calc(100% - ${theme.vars.spacing.md})`,
  })
}

export function Button() {
  return <button {...styles.button()}>Save</button>
}
```

Import `Button` normally. The named helpers retain inferred tokens; compilation supplies executable styles and CSS. For literal values without a theme, import `css` directly from `zyzz`.

## Choose Compilation

- **Bundler:** follow [Vite Setup](vite.md). The plugin transforms source imports and delivers CSS automatically.
- **Next.js:** follow [Next.js Setup](next.md). `zyzz(nextConfig)` wraps the existing configuration for webpack and Turbopack.
- **CLI:** the [proposed command-line setup](cli.md) remains unimplemented. Custom hosts can use the compiler APIs for downstream builds and library distribution.

Importing config alone does not compile styles. Source transformation supplies executable modules; emitting CSS alone cannot make untouched authoring calls executable.

## Continue

1. [Style Components](../guides/styling.md#style-components).
2. [Use Themes](../guides/themes.md#use-themes).
3. [Define Variants](../guides/variants.md#define-variants).
