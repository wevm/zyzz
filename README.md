# typestyle

A type-safe styling library for agents. Familiar CSS, inferred design tokens, and small APIs make styles straightforward to generate, inspect, and change.

- [**Typed Styles**](#typed-styles): typed CSS properties, values, selectors, and queries.
- [**Dynamic Styles**](#dynamic-styles): callable styles with typed runtime values and static CSS.
- [**Themes**](#themes): bundled or custom tokens with light and dark color schemes.
- [**Variants**](#variants): component choices with inferred props and data attributes.
- [**Value Context**](#value-context): fallbacks, importance, expressions, and theme CSS variables.
- [**Variables**](#variables): typed runtime values bound to static rules.
- [**Composition**](#composition): explicit overrides between generated styles.
- [**Stylesheets and Compilation**](#stylesheets-and-compilation): global rules, animations, fonts, and web/native output.
- [**CLI**](#cli): standalone compilation with watch mode.

## Philosophy

- **Typed.** Properties, tokens, and variants carry their constraints into every call.
- **Standard.** Styles use familiar CSS properties, selectors, queries, and cascade behavior.
- **Agnostic.** The core is independent of frameworks, build tools, and environments.
- **Universal.** Shared definitions target web and native with explicit platform capabilities.
- **Minimal.** Small, composable APIs keep configuration and dependencies optional.
- **Compiled.** Rules compile ahead of time into compact output with readable class names on web.

## Overview

Pass standard CSS properties and values to `css` and use the result as a class name. The core has no built-in tokens; styles compile into CSS ahead of time.

```tsx
import { css } from 'typestyle'

export function Button() {
  return (
    <button className={css({ color: '#06c', padding: '1rem' })}>
      Continue
    </button>
  )
}
```

## Features

### Typed Styles

Use `css` inline or as an exported class string. Nest selectors and queries alongside typed declarations.

```tsx
import { css } from 'typestyle'

const button = css({
  color: '#06c',
  padding: '1rem',
  ':hover': { opacity: 0.8 },
})

<button className={button}>Continue</button>
```

### Dynamic Styles

Add a typed second callback parameter to create callable styles. `c` supplies the same value helpers as static callbacks. The result contains a class name and inline variable assignments; CSS rules stay static.

```tsx
import { css } from 'typestyle'

const bar = css((c, width: `${number}%`) => ({ width }))

export function Bar() {
  return <div {...bar('50%')} />
}
```

### Themes

Import a bundled theme's `css` for inferred design tokens. `typestyle/themes/default` also exports bound `variants`, the full `theme`, and raw `tokens` for extension and reuse.

```ts
import { css } from 'typestyle/themes/default'

const button = css({ color: 'blue.700', padding: 4 })
```

Define tokens once and get a `css` function that infers them. Colors accept a shared value or a light/dark pair; query aliases infer from theme thresholds.

```ts
import { Theme } from 'typestyle'

const theme = Theme.define({
  color: { text: { light: '#111', dark: '#eee' }, brand: '#06c' },
  spacing: { sm: '0.5rem', md: '1rem' },
  breakpoints: { tablet: '48rem' },
})

const card = theme.css({
  color: 'text',
  padding: 'sm',
  '@media tablet': { padding: 'md' },
})
```

Use `Theme.extend(theme, overrides)` to create an alternate theme, and apply its `className` to a subtree for inherited token overrides.

### Variants

Describe component choices with inferred props, defaults, and compound rules. Use `theme.variants` for theme tokens or import token-free `variants` from `typestyle`. Web variants select styles through data attributes.

```tsx
const button = theme.variants({
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
;<button {...button({ size: 'sm' })}>Continue</button>
```

### Value Context

The context `c` supplies value helpers and inferred theme references. Use `c.vars` for CSS `var(...)` references, directly in properties or ordinary template literals; they follow inherited theme overrides and color schemes.

```ts
const panel = theme.css((c) => ({
  display: c.fallback('block', 'grid'),
  color: c.important('brand'),
  borderColor: c.vars.color.brand,
  width: `calc(100% - ${c.vars.spacing.md})`,
}))
```

### Variables

Bind runtime values to typed variables while keeping the CSS rules static.

```tsx
import { Vars, css } from 'typestyle'

const progress = Vars.define({ amount: 'percentage' })
const bar = css({ width: progress.amount })

<div className={bar} style={Vars.set(progress, { amount: '50%' })} />
```

### Composition

Prefer state attributes for conditional styling. Use `cx` for explicit overrides between generated styles in matching selector and condition contexts.

```tsx
import { css, cx } from 'typestyle'

const base = css({ padding: '0.5rem' })
const roomy = css({ padding: '1rem' })

<button className={cx(base, roomy)}>Continue</button>
```

### Stylesheets and Compilation

`Css` provides global rules, keyframes, fonts, and in-memory CSS compilation. `StyleSheet` compiles shared `Style` definitions into React Native styles and selects precompiled theme values.

```ts
import { Style } from 'typestyle'
import { Css } from 'typestyle/web'

Css.global({ body: { margin: 0 } })

const styles = Style.define({
  card: { display: 'flex' },
})
const output = Css.compile({ styles })
```

```ts
import { StyleSheet } from 'typestyle/react-native'

const output = StyleSheet.compile({ styles, themes: { base: theme } })
const selected = StyleSheet.select(output.styles, {
  theme: 'base',
  colorScheme: 'dark',
})
```

### CLI

Compile source modules and styles independently of a build integration. Watch mode updates output as definitions change.

```sh
typestyle src --out-dir dist --watch
typestyle src --out-dir dist --minify
```

## Comparison

See [the comparison](COMPARISON.md) for examples covering authoring, developer and agent experience, compilation, performance, and bundle size.
