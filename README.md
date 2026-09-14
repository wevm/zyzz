<h1 align="center">zyzz</h1>

<p align="center">
  Next-gen styling library for the modern era
</p>

<p align="center">
  <a href="#overview">Overview</a> · <a href="#getting-started">Getting Started</a> · <a href="#philosophy">Philosophy</a> · <a href="#features">Features</a> · <a href="#comparison">Comparison</a> · <a href="docs/guides/README.md">Guides</a> · <a href="docs/concepts.md">Concepts</a> · <a href="docs/api/README.md">API Reference</a>
</p>

## Overview

Zyzz combines typed CSS, design tokens, themes, and variants with ahead-of-time compilation. Group component styles in `namespace styles {}`, call them, and spread the resulting props onto elements.

```tsx
import { css } from 'zyzz'

namespace styles {
  export const button = css({ color: '#06c', padding: '1rem' })

  export const card = css({ display: 'grid', gap: '1rem', padding: '1.5rem' })
}

export function Card() {
  return (
    <article {...styles.card()}>
      <h2>Get started</h2>
      <button {...styles.button()}>Continue</button>
    </article>
  )
}
```

## Getting Started

Try the [React + Vite playground](examples/vite-react) or the other [examples](examples) with `pnpm examples` from a repository checkout.

### Install

```sh
npm install zyzz
```

Then:

- [Setup with Vite](#setup-with-vite)
- [Setup with CLI](#setup-with-cli)
- [Use Compiler API](#use-compiler-api)

### Setup with Vite

Add `zyzz()` to the existing plugins array, alongside the application's framework plugin:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { zyzz } from 'zyzz/vite'

export default defineConfig({
  plugins: [zyzz()],
})
```

Import components normally. The plugin transforms source modules and delivers CSS automatically during development and production builds. See [Vite Setup](docs/introduction/vite.md).

### Setup with CLI

Build or watch source files:

```sh
npx zyzz build
npx zyzz dev
```

Compiles `src` to `dist`, emitting adjacent module CSS and `zyzz.shared.css` for shared contributions. See [CLI Setup](docs/introduction/cli.md).

### Use Compiler API

Build source files programmatically with `Host` from `zyzz/node`:

```ts
import { Host } from 'zyzz/node'

await using host = await Host.create({
  outDir: 'dist',
  packageId: 'my-app',
  root: 'src',
})

await host.build()
```

The CLI compiles source modules and CSS to `dist` by default. Add `--css-only` to emit CSS and CSS maps for original source; declarations that need independent identities then require explicit IDs. See [CLI](docs/introduction/cli.md).

For watching, keep the scope alive until shutdown:

```ts
import { once } from 'node:events'

host.watch({
  onResult: (event) => console.log(event),
})
await once(process, 'SIGINT')
```

Watching performs an initial build, then reports rebuilds and errors. `await using` stops watchers, drains pending builds, and releases the output lock when the scope exits. See [Host.create](docs/api/node/Host/create.md).

## Philosophy

- **Typed.** Properties, tokens, and variants carry their constraints into every call.
- **Standard.** Styles use familiar CSS properties, selectors, queries, and cascade behavior.
- **Agnostic.** The core is independent of frameworks, build tools, and environments.
- **Universal.** Shared definitions target web and native with explicit platform capabilities.
- **Minimal.** Small, composable APIs keep configuration and dependencies optional.
- **Compiled.** Rules compile ahead of time into compact output with readable class names on web.

## Features

- [**Typed Styles**](#typed-styles): familiar CSS with property and value inference, inline or reusable.
- [**Themes**](#themes): inferred design tokens, optional defaults, and compatible overrides.
- [**Color Schemes (Light/Dark Mode)**](#color-schemes-lightdark-mode): light/dark token pairs selected by CSS, without a preference listener.
- [**Variants**](#variants): typed component choices, defaults, and compound rules.
- [**Dynamic Styles**](#dynamic-styles): runtime values bound to static CSS through custom properties.
- [**Composition**](#composition): explicit style overrides that retain bindings and variant attributes.
- [**Static CSS**](#static-css): ahead-of-time output with readable classes and no runtime rule generation.

### Typed Styles

Standard CSS properties and values carry TypeScript inference into each definition. Styles can live beside components or in shared modules; applying them returns ordinary styling props without a provider or component wrapper.

```tsx
import { css } from 'zyzz'

namespace styles {
  export const button = css({
    color: '#06c',
    padding: '1rem',
    ':hover': { opacity: 0.8 },
  })
}

const example = <button {...styles.button()}>Continue</button>
```

### Themes

Token names infer by property, and compatible theme scopes change inherited values without changing component styles. Core imports remain token-free.

#### Default Theme

The planned `zyzz/themes/default` entrypoint will provide inferred colors, typography, spacing, and radius tokens through bound `css` and `variants`, plus `theme` and raw `tokens`. It remains unpublished until Phase 3 adds variants. These examples preview that API.

```ts
import { css } from 'zyzz/themes/default'

namespace styles {
  export const button = css({ color: 'blue.700', padding: 4 })
}
```

Extend the default theme with [`Theme.extend`](docs/api/core/Theme/extend.md) to override existing tokens while retaining all other values and the same token contract.

```ts
// zyzz.config.ts
import { Config, Theme } from 'zyzz'
import { theme as defaultTheme } from 'zyzz/themes/default'

export const { css, theme, variants } = Config.create({
  theme: Theme.extend(defaultTheme, {
    color: { blue: { 700: '#175' } },
  }),
})
```

```ts
import { css } from './zyzz.config.js'

namespace styles {
  export const button = css({ color: 'blue.700', padding: 4 })
}
```

#### Custom Theme

Export named config helpers with an application's own tokens. Colors accept a shared value or a light/dark pair.

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export const { css, theme, variants } = Config.create({
  theme: {
    color: { brand: '#06c', text: { dark: '#eee', light: '#111' } },
    spacing: { md: '1rem', sm: '0.5rem' },
  },
})
```

```ts
import { css } from './zyzz.config.js'

namespace styles {
  export const card = css({ color: 'text', padding: 'sm' })
}
```

Use [`Theme.define`](docs/api/core/Theme/define.md) for reusable definitions outside config. See [Themes & Tokens](docs/guides/themes.md) for nested scopes and named alternatives.

### Color Schemes (Light/Dark Mode)

Apply the theme to `<html>` and select a color scheme through its callable props:

```tsx
import { css, theme } from './zyzz.config.js'

namespace styles {
  export const card = css({ color: 'text', padding: 'sm' })
}

export function Document() {
  return (
    <html {...theme({ colorScheme: 'light dark' })}>
      <head>
        <title>My App</title>
      </head>
      <body>
        <article {...styles.card()}>Content</article>
      </body>
    </html>
  )
}
```

The theme returns its generated `className` and `styles.colorScheme`. Use `'light'` or `'dark'` for an explicit scheme, or `'light dark'` for system preference. Named themes use `themes({ theme: 'mint', colorScheme: 'dark' })`.

Color pairs compile to `light-dark()`; the custom theme's `text` token resolves to `#111` in light mode and `#eee` in dark mode. Nested theme calls can scope a subtree independently.

For saved preferences, `script()` generates an optional [initialization script](docs/guides/themes.md#restore-preferences) for `<head>`. It restores the theme and scheme from localStorage before first paint. System preference needs no script or provider.

### Variants

Describe component choices with inferred props, defaults, and compound rules. Use `variants` for theme tokens or import token-free `variants` from `zyzz`. Web variants select styles through data attributes.

```tsx
import { variants } from './zyzz.config.js'

namespace styles {
  export const button = variants({
    base: { display: 'inline-flex' },
    variants: {
      size: {
        sm: { padding: 'sm' },
        md: { padding: 'md' },
      },
    },
    defaultVariants: { size: 'md' },
  })
}

type ButtonProps = NonNullable<Parameters<typeof styles.button>[0]>
const example = <button {...styles.button({ size: 'sm' })}>Continue</button>
```

### Dynamic Styles

Mix static declarations with typed runtime values in the same callback. Call the style with those values and optional `className`/`style`/`variables` overrides; consumed values become CSS variable assignments. Other component props stay on the component. CSS rules stay static.

```tsx
import { css } from 'zyzz'

namespace styles {
  export const bar = css((values: { width: `${number}%` }) => ({
    backgroundColor: '#06c',
    borderRadius: '0.25rem',
    height: '0.5rem',
    width: values.width,
  }))
}

export function Bar() {
  return (
    <div
      {...styles.bar({ width: '50%', className: 'progress' })}
      aria-hidden={true}
    />
  )
}
```

### Value Syntax

Use trailing `!` for importance and arrays for ordered fallbacks. `theme.vars` provides typed CSS variable references for ordinary CSS expressions; `theme.tokens` provides portable token references.

```ts
import { css, theme } from './zyzz.config.js'

namespace styles {
  export const panel = css({
    display: ['block', 'grid'],
    color: 'brand!',
    borderColor: theme.vars.color.brand,
    width: `calc(100% - ${theme.vars.spacing.md})`,
  })
}
```

### Composition

Prefer state attributes for conditional styling. Calls accept `className`, `style`, and `variables` overrides. Classes are retained and inline styles merge. Other props stay on the component. Use `cx` for explicit overrides between generated styles in matching selector and condition contexts.

```tsx
import { css, cx } from 'zyzz'

namespace styles {
  export const base = css({ padding: '0.5rem' })

  export const roomy = css({ padding: '1rem' })
}

const example = (
  <button {...cx(styles.base(), styles.roomy())} disabled>
    Continue
  </button>
)
```

### Static CSS

Styles compile ahead of time into CSS. The optional compiler also optimizes authoring calls into props and small runtime helpers. It is enabled by default in Vite; `zyzz({ compiler: false })` retains authoring calls while delivering CSS. Neither mode generates CSS at runtime.

Use the [Vite plugin](docs/introduction/vite.md) for source transformation and CSS delivery, or the [compiler APIs](docs/guides/compilation.md) for standalone builds and library distribution.

See [Benchmarks](docs/introduction/benchmarks.md) for measured compilation, runtime, and output-size comparisons.

## Comparison

See [the comparison](docs/introduction/comparisons.md) for examples covering authoring, developer and agent experience, compilation, performance, and bundle size.
