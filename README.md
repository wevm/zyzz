<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/logo-dark.svg">
    <img alt="zyzz" src=".github/assets/logo-light.svg" width="170" height="76">
  </picture>
</p>

<p align="center">
  Modern, universal, simple styling library for the Web and React Native
</p>

<p align="center">
  <a href="#overview">Overview</a> · <a href="#getting-started">Getting Started</a> · <a href="#philosophy">Philosophy</a> · <a href="#features">Features</a> · <a href="docs/guides/README.md">Guides</a> · <a href="docs/api/README.md">API Reference</a>
</p>

## Overview

```tsx
import { style } from 'zyzz'

namespace styles {
  export const button = style({ color: '#06c', padding: '1rem' })

  export const card = style({ display: 'grid', gap: '1rem', padding: '1.5rem' })
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

## Philosophy

- **Typed.** Properties, tokens, and variants carry their constraints into every call.
- **Standard.** Styles use familiar CSS properties, selectors, queries, and cascade behavior.
- **Agnostic.** The core is independent of frameworks, build tools, and environments.
- **Universal.** Shared definitions target web and native with explicit platform capabilities.
- **Minimal.** Small, composable APIs keep configuration and dependencies optional.
- **Compiled.** Rules compile ahead of time into compact output with readable class names on web.

Read [Thinking in Zyzz](docs/introduction/thinking-in-zyzz.md) for co-location, composition, and styling conventions.

## Features

- [**Typed Styles**](#typed-styles): familiar CSS with property and value inference, inline or reusable.
- [**Themes**](#themes): inferred design tokens, optional defaults, and compatible overrides.
- [**Color Schemes (Light/Dark Mode)**](#color-schemes-lightdark-mode): light/dark token pairs selected by CSS, without a preference listener.
- [**Variants**](#variants): typed component choices, defaults, and compound rules.
- [**Dynamic Styles**](#dynamic-styles): runtime values bound to static CSS through custom properties.
- [**Value Syntax**](#value-syntax): importance, ordered fallbacks, and typed token and variable references.
- [**Composition**](#composition): explicit style overrides that retain bindings and variant attributes.
- [**Static CSS**](#static-css): ahead-of-time output with readable classes and no runtime rule generation.

## Getting Started

### Install

```sh
npm install zyzz
```

### Usage

Choose an integration or compile styles with the CLI or compiler API:

- [Vite](#vite)
- [Next.js](#nextjs)
- [React Native](#react-native)
- [Other Bundlers](#other-bundlers)
- [CLI](#cli)
- [Compiler API](#compiler-api)

### Vite

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

### Next.js

Wrap the existing Next.js configuration with `zyzz()`:

```ts
// next.config.ts
import { zyzz } from 'zyzz/next'

export default zyzz({
  reactStrictMode: true,
})
```

The integration handles source transformation and CSS delivery for Webpack and Turbopack. See [Next.js Setup](docs/introduction/next.md).

### React Native

Wrap the Expo Metro configuration with `zyzz()`:

```ts
// metro.config.ts
import { getDefaultConfig } from 'expo/metro-config'
import { zyzz } from 'zyzz/metro'

export default zyzz(getDefaultConfig(import.meta.dirname), {
  units: { px: 1 },
})
```

Metro compiles styles during iOS and Android bundling. Connect the [React provider](docs/api/react-native/react.md) above the application for theme and color scheme selection. See [Metro Setup](docs/api/metro/README.md) and the [Expo example](examples/react-native).

### Other Bundlers

Use the unplugin adapters with Rollup, Webpack, or esbuild:

```ts
import { zyzz } from 'zyzz/unplugin'

const plugins = [zyzz.esbuild()] // or zyzz.rollup() / zyzz.webpack()
```

The adapters emit `zyzz.css` and `zyzz.js` beside the JavaScript bundle. Load these files in the application document. See [Bundler Setup](docs/api/unplugin/README.md) for configuration and output requirements.

### CLI

Build or watch source files:

```sh
npx zyzz build
npx zyzz dev
```

Compiles `src` to `dist`, emitting `zyzz.css` as the complete stylesheet and `zyzz.js` as the saved-selection script beside adjacent module CSS and `zyzz.shared.css` for shared contributions. See [CLI Setup](docs/introduction/cli.md).

### Compiler API

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

The CLI compiles source modules and CSS to `dist` by default. Add `--css-only` to emit CSS, CSS maps, and the initialization script for original source; declarations that need independent identities then require explicit IDs. See [CLI](docs/introduction/cli.md).

For watching, keep the scope alive until shutdown:

```ts
import { once } from 'node:events'

host.watch({
  onResult: (event) => console.log(event),
})
await once(process, 'SIGINT')
```

Watching performs an initial build, then reports rebuilds and errors. `await using` stops watchers, drains pending builds, and releases the output lock when the scope exits. See [Host.create](docs/api/node/Host/create.md).

## Walkthrough

### Typed Styles

Standard CSS properties and values carry TypeScript inference into each definition. Styles can live beside components or in shared modules; applying them returns ordinary styling props without a provider or component wrapper.

```tsx
import { style } from 'zyzz'

namespace styles {
  export const button = style({
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

The `zyzz/default` entrypoint provides inferred colors, typography, spacing, and radius tokens through bound `style` and `variants`, plus `vars`, raw `tokens`, `appearance` controls, and a `script()` helper for restoring saved color-scheme preferences. Scales use conventional named steps, and colors ship as light/dark pairs.

```ts
import { style } from 'zyzz/default'

namespace styles {
  export const button = style({ color: 'blue.700', padding: 4 })
}
```

Extend the default theme with [`Vars.extend`](docs/api/core/Vars/README.md) to override existing tokens while retaining all other values and the same token contract.

```ts
// zyzz.config.ts
import { Config, Vars } from 'zyzz'
import { vars as defaultVars } from 'zyzz/default'

export const { style, vars, variants } = Config.create({
  vars: Vars.extend(defaultVars, {
    color: { blue: { 700: '#175' } },
  }),
})
```

```ts
import { style } from './zyzz.config.js'

namespace styles {
  export const button = style({ color: 'blue.700', padding: 4 })
}
```

#### Custom Theme

Export named config helpers with an application's own tokens. Colors accept a shared value or a light/dark pair.

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export const { style, vars, variants } = Config.create({
  vars: {
    color: { brand: '#06c', text: { dark: '#eee', light: '#111' } },
    spacing: { md: '1rem', sm: '0.5rem' },
  },
})
```

```ts
import { style } from './zyzz.config.js'

namespace styles {
  export const card = style({ color: 'text', padding: 'sm' })
}
```

Use [`Vars.define`](docs/api/core/Vars/README.md) for reusable definitions outside config. See [Themes & Tokens](docs/guides/themes.md) for nested scopes and named alternatives.

### Color Schemes (Light/Dark Mode)

Apply the theme to `<html>` and select a color scheme through its callable props:

```tsx
import { style, vars } from './zyzz.config.js'

namespace styles {
  export const card = style({ color: 'text', padding: 'sm' })
}

export function Document() {
  return (
    <html {...vars({ colorScheme: 'light dark' })}>
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

The theme returns its generated `className`, including a compiled scheme class, and `style.colorScheme`. Use `'light'` or `'dark'` for an explicit scheme, or `'light dark'` for system preference. Named themes use `vars({ set: 'mint', colorScheme: 'dark' })`.

Color pairs compile to `light-dark()`; the custom theme's `text` token resolves to `#111` in light mode and `#eee` in dark mode. Nested theme calls can scope a subtree independently.

For saved preferences, `script()` generates an optional [initialization script](docs/guides/themes.md#restore-preferences) for `<head>`. It restores the theme and scheme from localStorage before first paint, and `appearance.set({ set: 'mint', colorScheme: 'dark' })` applies and saves a change from the client. System preference needs no script or provider.

### Variants

Describe component choices with inferred props, defaults, and compound rules. Use `variants` for theme tokens or import token-free `variants` from `zyzz`. Web variants select styles through data attributes.

```tsx
import type { Props } from 'zyzz'
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

export function Button(props: Props.Variants<typeof styles.button>) {
  return <button {...styles.button(props)}>Continue</button>
}

const example = <Button size="sm" />
```

### Dynamic Styles

Mix static declarations with typed runtime values in the same callback. Call the style with those values and optional `className`/`style`/`vars` overrides; consumed values become CSS variable assignments. Other component props stay on the component. CSS rules stay static.

```tsx
import { style } from 'zyzz'

namespace styles {
  export const bar = style((values: { width: `${number}%` }) => ({
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

Use the suffix ` !important` for importance and arrays for ordered fallbacks. `vars` provides typed references for declarations and CSS expressions.

```ts
import { style, vars } from './zyzz.config.js'

namespace styles {
  export const panel = style({
    display: ['block', 'grid'],
    color: 'brand !important',
    borderColor: vars.color.brand,
    width: `calc(100% - ${vars.spacing.md})`,
  })
}
```

### Composition

Prefer state attributes for conditional styling. Calls accept `className`, `style`, and `vars` overrides. Classes are retained and inline styles merge. Other props stay on the component. Use `cx` for explicit overrides between generated styles in matching selector and condition contexts.

```tsx
import { cx, style } from 'zyzz'

namespace styles {
  export const base = style({ padding: '0.5rem' })

  export const roomy = style({ padding: '1rem' })
}

const example = (
  <button {...cx(styles.base(), styles.roomy())} disabled>
    Continue
  </button>
)
```

### Static CSS

Use the [Vite plugin](docs/introduction/vite.md) for source transformation and CSS delivery, or the [compiler APIs](docs/guides/compilation.md) for standalone builds and library distribution.

## Benchmarks

See [Benchmarks](docs/introduction/benchmarks.md) for measured compilation, runtime, and output-size comparisons.

## Comparison

See [the comparison](docs/introduction/comparisons.md) for examples covering authoring, developer and agent experience, compilation, performance, and bundle size.
