# Getting Started

Define styles with a config instance and spread their applied props onto a component. Imports always refer to authored source files.

> [!NOTE]
> Config authoring, package installation, and integrations below describe the planned release. Use the [compiler APIs](../guides/compilation.md) for the current literal pipeline.

## Install

```sh
pnpm add zyzz
```

## Define Config

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export default Config.create({
  theme: {
    color: { brand: { dark: '#8cf', light: '#06c' } },
    spacing: { md: '1rem' },
  },
})
```

## Style a Component

```tsx
// Button.tsx
import config from './zyzz.config.js'

const button = config.css({
  backgroundColor: 'brand',
  padding: 'md',
})

export function Button() {
  return <button {...button()}>Save</button>
}
```

Import `Button` normally. Config supplies inferred tokens; compilation supplies the executable styles and CSS. For literal values without a theme, import `css` directly from `zyzz`.

## Choose Compilation

- **Bundler:** follow [Vite Setup](vite.md). The plugin transforms source imports and delivers CSS automatically.
- **CLI:** follow [CLI Setup](cli.md). The standalone compiler emits modules and CSS for a downstream build or library distribution.

Importing config alone does not compile styles. The CLI is a source-transform path; it cannot make untouched authoring calls executable by emitting CSS alone.

## Continue

1. [Style Components](../guides/styling.md).
2. [Use Themes](../guides/themes.md).
3. [Define Variants](../guides/variants.md).
