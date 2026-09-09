<h1 align="center">zyzz</h1>

<p align="center">
  Next-gen styling library for the modern era
</p>

<p align="center">
  <a href="#overview">Overview</a> · <a href="#getting-started">Getting Started</a> · <a href="#philosophy">Philosophy</a> · <a href="#features">Features</a> · <a href="#comparison">Comparison</a> · <a href="docs/guides/README.md">Guides</a> · <a href="docs/concepts.md">Concepts</a> · <a href="docs/api/README.md">API Reference</a>
</p>

## Overview

Zyzz combines typed CSS, design tokens, themes, and variants with ahead-of-time compilation. Define styles with `style` and apply the resulting values through the `style` prop.

```tsx
import { style } from 'zyzz'

const styles = {
  button: style({ color: '#06c', padding: '1rem' }),
}

export function Button() {
  return <button style={styles.button}>Continue</button>
}
```

## Getting Started

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
npx zyzz watch
```

Compiles `src` to `dist` and outputs CSS to `dist/styles.css` by default. See [CLI Setup](docs/introduction/cli.md).

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

The host writes rewritten modules, CSS sidecars, and source maps to `dist`. Downstream tooling handles TypeScript/JSX lowering and stylesheet loading.

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

Standard CSS properties and values carry TypeScript inference into each definition. Styles can live beside components or in shared modules; the compiler applies them through native element props without a provider or custom JSX runtime.

```tsx
import { style } from 'zyzz'

const styles = {
  button: style({
    color: '#06c',
    padding: '1rem',
  }),
}

const example = <button style={styles.button}>Continue</button>
```

### Themes

Token names infer by property, and compatible theme scopes change inherited values without changing component styles. Core imports remain token-free.

#### Default Theme

Import the default theme's `style` for inferred colors, typography, spacing, and radius tokens. `zyzz/themes/default` also exports bound `variants`, the full `theme`, and raw `tokens` for extension and reuse.

```ts
import { style } from 'zyzz/themes/default'

const button = style({ color: 'blue.700', padding: 4 })
```

Extend the default theme with [`Theme.extend`](docs/api/core/Theme/extend.md) to override existing tokens while retaining all other values and the same token contract.

```ts
// zyzz.config.ts
import { Config, Theme } from 'zyzz'
import { theme as defaultTheme } from 'zyzz/themes/default'

export const { style } = Config.create({
  theme: Theme.extend(defaultTheme, {
    color: { blue: { 700: '#175' } },
  }),
})
```

```ts
import { style } from './zyzz.config.js'

const button = style({ color: 'blue.700', padding: 4 })
```

Preview API; not yet implemented.

#### Custom Theme

Export named helpers from a config with application tokens. Colors accept a shared value or a light/dark pair.

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export const { style, theme } = Config.create({
  theme: {
    color: { brand: '#06c', text: { dark: '#eee', light: '#111' } },
    spacing: { md: '1rem', sm: '0.5rem' },
  },
})
```

```ts
import { style } from './zyzz.config.js'

const card = style({ color: 'text', padding: 'sm' })
```

Use [`Theme.define`](docs/api/core/Theme/define.md) for reusable definitions outside config. See [Themes & Tokens](docs/guides/themes.md) for nested scopes and named alternatives.

### Color Schemes (Light/Dark Mode)

Apply the theme to `<html>` and declare supported color schemes in `<head>`:

```tsx
import { style, theme } from './zyzz.config.js'

const styles = {
  card: style({ color: 'text', padding: 'sm' }),
}

export function Document() {
  return (
    <html style={theme}>
      <head>
        <meta name="color-scheme" content="light dark" />
        <title>My App</title>
      </head>
      <body>
        <article style={styles.card}>Content</article>
      </body>
    </html>
  )
}
```

The compiler applies the theme's generated scope class. Use `light` or `dark` in the meta tag for an explicit scheme, or `light dark` for system preference. Named themes can be applied with `style={themes.mint}`.

Color pairs compile to `light-dark()`; the custom theme's `text` token resolves to `#111` in light mode and `#eee` in dark mode. Nested theme values can scope a subtree independently.

For saved preferences, `zyzz.script()` generates an optional [initialization script](docs/guides/themes.md#restore-preferences) for `<head>`. It restores the theme and scheme from localStorage before first paint. System preference needs no script or provider.

### Variants

Describe component choices with inferred props, defaults, and compound rules. Use `variants` for theme tokens or import token-free `variants` from `zyzz`. Web variants select styles through data attributes.

```tsx
import { variants } from './zyzz.config.js'

const styles = {
  button: variants({
    base: { display: 'inline-flex' },
    variants: {
      size: {
        sm: { padding: 'sm' },
        md: { padding: 'md' },
      },
    },
    defaultVariants: { size: 'md' },
  }),
}

type ButtonProps = NonNullable<Parameters<typeof styles.button>[0]>
const example = <button style={styles.button({ size: 'sm' })}>Continue</button>
```

Preview API; not yet implemented.

### Dynamic Styles

Mix static declarations with typed runtime values in the same callback. Call the dynamic style with those values; consumed values become CSS variable assignments. Other component props stay on the component. CSS rules stay static.

```tsx
import { style } from 'zyzz'

const styles = {
  bar: style((values: { width: `${number}%` }) => ({
    backgroundColor: '#06c',
    borderRadius: '0.25rem',
    height: '0.5rem',
    width: values.width,
  })),
}

export function Bar() {
  return (
    <div
      className="progress"
      style={styles.bar({ width: '50%' })}
      aria-hidden={true}
    />
  )
}
```

Preview API; not yet implemented.

### Value Syntax

Use trailing `!` for importance and arrays for ordered fallbacks. `theme.vars` provides typed CSS variable references for ordinary CSS expressions; `theme.tokens` provides portable token references.

```ts
import { style, theme } from './zyzz.config.js'

const panel = style({
  display: ['block', 'grid'],
  color: 'brand!',
  borderColor: theme.vars.color.brand,
  width: `calc(100% - ${theme.vars.spacing.md})`,
})
```

### Composition

Prefer state attributes for conditional styling. Put external classes on the element and inline overrides alongside one spread style value. Other props stay on the component. Use `cx` for explicit overrides between generated styles in matching selector and condition contexts.

```tsx
import { style, cx } from 'zyzz'

const styles = {
  base: style({ padding: '0.5rem' }),

  roomy: style({ padding: '1rem' }),
}

const example = (
  <button style={cx(styles.base, styles.roomy)} disabled>
    Continue
  </button>
)
```

Preview API; not yet implemented.

### Static CSS

Styles compile ahead of time into CSS and executable modules with source maps. Static definitions become values; intrinsic JSX elements resolve them into DOM props. Generated functions never create CSS rules, and unused theme tokens emit no declarations.

Use the [Vite plugin](docs/introduction/vite.md) for source transformation and CSS delivery, or the [compiler APIs](docs/guides/compilation.md) for standalone builds and library distribution.

See [Benchmarks](docs/introduction/benchmarks.md) for measured compilation, runtime, and output-size comparisons.

## Comparison

See [the comparison](docs/introduction/comparisons.md) for examples covering authoring, developer and agent experience, compilation, performance, and bundle size.
