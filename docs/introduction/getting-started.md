# Getting Started

Import bound styling helpers and spread their applied props onto a component. Imports always refer to authored source files.

> [!NOTE]
> The Config/Vite source workflow below is implemented. Next.js and native integrations retain separate implementation gates. Custom hosts can use the [compiler APIs](../guides/compilation.md#publish-libraries).

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
- **Next.js:** the [proposed setup](next.md) remains unimplemented.
- **CLI:** use [`zyzz build` or `zyzz dev`](cli.md) for standalone output, downstream builds, and library distribution.

Importing config alone does not emit CSS. The [CLI](cli.md) emits CSS for unchanged authoring source. Vite delivers CSS automatically and enables source optimization by default; `zyzz({ compiler: false })` disables optimization. Without compilation, identity-bearing declarations require explicit IDs.

## Continue

1. [Style Components](../guides/styling.md#style-components).
2. [Use Themes](../guides/themes.md#use-themes).
3. [Define Variants](../guides/variants.md#define-variants).
