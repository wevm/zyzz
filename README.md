# Zyzz

A type-safe styling library for agents. Familiar CSS, inferred design tokens, and small APIs make styles straightforward to generate, inspect, and change.

- [**Typed Styles**](#typed-styles): familiar CSS with property and value inference, inline or reusable.
- [**Themes**](#themes): inferred design tokens, optional defaults, and compatible overrides.
- [**Dark Mode**](#dark-mode): light/dark token pairs selected by CSS, without a preference listener.
- [**Variants**](#variants): typed component choices, defaults, and compound rules.
- [**Dynamic Styles**](#dynamic-styles): runtime values bound to static CSS through custom properties.
- [**Composition**](#composition): explicit style overrides that retain bindings and variant attributes.
- [**Static CSS**](#static-css): ahead-of-time output with readable classes and no runtime rule generation.

[Getting Started](docs/introduction/getting-started.md) · [Guides](docs/guides/README.md) · [Concepts](docs/concepts.md) · [API Reference](docs/api/README.md)

## Philosophy

- **Typed.** Properties, tokens, and variants carry their constraints into every call.
- **Standard.** Styles use familiar CSS properties, selectors, queries, and cascade behavior.
- **Agnostic.** The core is independent of frameworks, build tools, and environments.
- **Universal.** Shared definitions target web and native with explicit platform capabilities.
- **Minimal.** Small, composable APIs keep configuration and dependencies optional.
- **Compiled.** Rules compile ahead of time into compact output with readable class names on web.

## Overview

Define styles with `css`, call them, and spread the resulting props onto a component. The core has no built-in tokens; styles compile into CSS ahead of time.

```tsx
import { css } from 'zyzz'

const button = css({ color: '#06c', padding: '1rem' })

export function Button() {
  return <button {...button()}>Continue</button>
}
```

## Features

### Typed Styles

Standard CSS properties and values carry TypeScript inference into each definition. Styles can live beside components or in shared modules; applying them returns ordinary styling props without a provider or component wrapper.

> [!NOTE]
> Nested selectors and queries below are preview syntax; literal declarations are supported by the source compiler.

```tsx
import { css } from 'zyzz'

const button = css({
  color: '#06c',
  padding: '1rem',
  ':hover': { opacity: 0.8 },
})

const example = <button {...button()}>Continue</button>
```

### Themes

Token names infer by property, and compatible theme scopes change inherited values without changing component styles. Core imports remain token-free.

> [!NOTE]
> Bundled themes and `Config.create` below are previews. Current compilation supports [authored theme definitions and extensions](docs/guides/themes.md#compile-local-theme-source).

#### Default Theme

Import the default theme's `css` for inferred colors, typography, spacing, and radius tokens. `zyzz/themes/default` also exports bound `variants`, the full `theme`, and raw `tokens` for extension and reuse.

```ts
import { css } from 'zyzz/themes/default'

const button = css({ color: 'blue.700', padding: 4 })
```

Extend the default theme with [`Theme.extend`](docs/api/core/Theme/extend.md) to override existing tokens while retaining all other values and the same token contract.

```ts
// zyzz.config.ts
import { Config, Theme } from 'zyzz'
import { theme } from 'zyzz/themes/default'

export const zyzz = Config.create({
  theme: Theme.extend(theme, {
    color: { blue: { 700: '#175' } },
  }),
})
```

`Theme.extend` accepts existing paths only. Define a custom theme for a different token vocabulary.

#### Custom Theme

Export a named `zyzz` instance with an application's own tokens. Colors accept a shared value or a light/dark pair.

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export const zyzz = Config.create({
  theme: {
    color: { brand: '#06c', text: { dark: '#eee', light: '#111' } },
    spacing: { md: '1rem', sm: '0.5rem' },
  },
})
```

```ts
import { zyzz } from './zyzz.config.js'

const card = zyzz.css({ color: 'text', padding: 'sm' })
```

Use [`Theme.define`](docs/api/core/Theme/define.md) for reusable definitions outside config. See [Themes & Tokens](docs/guides/themes.md) for nested scopes and named alternatives.

### Dark Mode

Color pairs compile to `light-dark()`. CSS selects the scheme independently of the theme, including system preference without a JavaScript listener.

```css
:root {
  color-scheme: light dark;
}
.light {
  color-scheme: light;
}
.dark {
  color-scheme: dark;
}
```

The custom theme's `text` token resolves to `#111` in light mode and `#eee` in dark mode.

### Variants

> [!NOTE]
> Variant authoring is a preview; not yet implemented.

Describe component choices with inferred props, defaults, and compound rules. Use `zyzz.variants` for theme tokens or import token-free `variants` from `zyzz`. Web variants select styles through data attributes.

```tsx
import { zyzz } from './zyzz.config.js'

const button = zyzz.variants({
  base: { display: 'inline-flex' },
  variants: {
    size: {
      sm: { padding: 'sm' },
      md: { padding: 'md' },
    },
  },
  defaultVariants: { size: 'md' },
})

type ButtonProps = NonNullable<Parameters<typeof button>[0]>
const example = <button {...button({ size: 'sm' })}>Continue</button>
```

### Dynamic Styles

> [!NOTE]
> Callback authoring is a preview; not yet implemented.

A callback receives typed runtime values. Call the style with those values and optional `className`/`style` overrides; consumed values become CSS variable assignments. Other component props stay on the component. CSS rules stay static.

```tsx
import { css } from 'zyzz'

const bar = css((values: { width: `${number}%` }) => ({
  width: values.width,
}))

export function Bar() {
  return (
    <div {...bar({ width: '50%', className: 'progress' })} aria-hidden={true} />
  )
}
```

### Value Syntax

> [!NOTE]
> Config-bound expressions and `theme.vars` below are previews.

Use trailing `!` for importance and arrays for ordered fallbacks. `theme.vars` provides typed CSS variable references for ordinary CSS expressions; `theme.tokens` provides portable token references.

```ts
import { zyzz } from './zyzz.config.js'

const panel = zyzz.css({
  display: ['block', 'grid'],
  color: 'brand!',
  borderColor: zyzz.theme.vars.color.brand,
  width: `calc(100% - ${zyzz.theme.vars.spacing.md})`,
})
```

### Composition

> [!NOTE]
> `cx` is a preview; not yet implemented.

Prefer state attributes for conditional styling. Calls accept `className` and `style` overrides. Classes are retained and inline styles merge. Other props stay on the component. Use `cx` for explicit overrides between generated styles in matching selector and condition contexts.

```tsx
import { css, cx } from 'zyzz'

const base = css({ padding: '0.5rem' })
const roomy = css({ padding: '1rem' })

const example = (
  <button {...cx(base(), roomy())} disabled>
    Continue
  </button>
)
```

### Static CSS

Styles compile ahead of time into CSS and executable modules with source maps. Direct applications become props; exported definitions remain callable. Generated functions never create CSS rules, and unused theme tokens emit no declarations.

Use the [Vite plugin](docs/introduction/vite.md) for source transformation and CSS delivery, or the [compiler APIs](docs/guides/compilation.md) for standalone builds and library distribution.

> [!NOTE]
> [CLI](docs/introduction/cli.md) and [Next.js](docs/introduction/next.md) integrations are previews.

See [Benchmarks](docs/introduction/benchmarks.md) for measured compilation, runtime, and output-size comparisons.

## Comparison

See [the comparison](docs/introduction/comparisons.md) for examples covering authoring, developer and agent experience, compilation, performance, and bundle size.
