# Zyzz

A type-safe styling library for agents. Familiar CSS, inferred design tokens, and small APIs make styles straightforward to generate, inspect, and change.

- [**Typed Styles**](#typed-styles): typed CSS properties, values, selectors, and queries.
- [**Dynamic Styles**](#dynamic-styles): callable styles with typed runtime values and static CSS.
- [**Themes**](#themes): bundled or custom tokens with light and dark color schemes.
- [**Variants**](#variants): component choices with inferred props and data attributes.
- [**Value Syntax**](#value-syntax): fallbacks, importance, expressions, and theme CSS variables.
- [**Composition**](#composition): explicit overrides between generated styles.
- [**Stylesheets and Compilation**](#stylesheets-and-compilation): global rules, animations, fonts, and web/native output.
- [**Source Compilation**](#source-compilation): executable modules, static CSS, and source maps.
- [**File Builds**](#file-builds): incremental builds and filesystem watching.
- [**CLI**](#cli): standalone compilation with watch mode.

[Getting Started](docs/introduction/getting-started.md) · [Guides](docs/guides/README.md) · [Concepts](docs/concepts/README.md) · [API Reference](docs/api/README.md)

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

Use `css` inline or export a callable style definition. Nest selectors and queries alongside typed declarations.

```tsx
import { css } from 'zyzz'

const button = css({
  color: '#06c',
  padding: '1rem',
  ':hover': { opacity: 0.8 },
})

const example = <button {...button()}>Continue</button>
```

### Dynamic Styles

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

### Themes

[Compile theme tokens and inherited scopes from in-memory definitions.](docs/guides/in-memory-themes.md)

Import a bundled theme's `css` for inferred design tokens. `zyzz/themes/default` also exports bound `variants`, the full `theme`, and raw `tokens` for extension and reuse.

```ts
import { css } from 'zyzz/themes/default'

const button = css({ color: 'blue.700', padding: 4 })
```

Default-export a config to share inferred tokens. Colors accept a shared value or a light/dark pair.

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export default Config.create({
  theme: {
    color: { brand: '#06c', text: { dark: '#eee', light: '#111' } },
    spacing: { md: '1rem', sm: '0.5rem' },
  },
})
```

```ts
import config from './zyzz.config.js'

const card = config.css({ color: 'text', padding: 'sm' })
```

Use `Theme.define` and `Theme.extend` when tokens need a reusable definition outside config.

### Variants

Describe component choices with inferred props, defaults, and compound rules. Use `config.variants` for theme tokens or import token-free `variants` from `zyzz`. Web variants select styles through data attributes.

```tsx
const button = config.variants({
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

### Value Syntax

Use trailing `!` for importance and arrays for ordered fallbacks. `theme.vars` provides typed CSS variable references for ordinary CSS expressions; `theme.tokens` provides portable token references.

```ts
const panel = config.css({
  display: ['block', 'grid'],
  color: 'brand!',
  borderColor: config.theme.vars.color.brand,
  width: `calc(100% - ${config.theme.vars.spacing.md})`,
})
```

### Composition

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

### Stylesheets and Compilation

`global`, `keyframes`, and `fontFace` from `zyzz/web` define stylesheet rules. `Css` provides in-memory CSS compilation. `StyleSheet` compiles shared `Style` definitions into React Native styles and selects precompiled theme values.

```ts
import { Style } from 'zyzz'
import { Css, global } from 'zyzz/web'

global({ body: { margin: 0 } })

const styles = Style.define({
  card: { display: 'flex' },
})
const output = Css.compile({ styles })
```

Use `composition: 'independent'` to deduplicate complete applications whose composition is resolved before compilation. Those generated class lists must remain separate. The default `ordered` mode preserves stylesheet precedence across combined class lists.

```ts
import { StyleSheet } from 'zyzz/react-native'

const output = StyleSheet.compile({ styles, themes: { base: config.theme } })
const selected = StyleSheet.select(output.styles, {
  theme: 'base',
  colorScheme: 'dark',
})
```

### Source Compilation

Compile literal definitions into executable modules and static CSS with source maps. Direct applications become props; exported definitions remain callable. The transform accepts source text without reading files or evaluating application code.

```ts
import { Transform } from 'zyzz/compiler'

const output = Transform.compile({
  moduleId: 'app/button.tsx',
  source:
    "import { css } from 'zyzz'; export const button = css({ padding: 0 })",
})
// output.code, output.css, output.map, output.cssMap
```

### File Builds

Build source files through the same compiler, retain working output after source errors, and watch for changes. Explicit ownership protects unrelated files.

```ts
import { Host } from 'zyzz/node'

const host = await Host.create({
  outDir: 'dist/styles',
  packageId: 'my-library',
  root: 'src/styles',
})

try {
  await host.build()
} finally {
  await host.close()
}
```

### CLI

Compile source modules and styles independently of a build integration. Watch mode updates output as definitions change.

```sh
zyzz src --out-dir dist --watch
zyzz src --out-dir dist --minify
```

## Comparison

See [the comparison](COMPARISON.md) for examples covering authoring, developer and agent experience, compilation, performance, and bundle size.
