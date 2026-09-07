# typestyle

A type-safe styling library for agents. Familiar CSS, inferred design tokens, and small APIs make styles straightforward to generate, inspect, and change.

- [**Styles**](#styles): typed CSS properties, built-in tokens, selectors, and queries.
- [**Themes**](#themes): inferred tokens with light and dark color schemes.
- [**Variants**](#variants): component choices with inferred props and data attributes.
- [**Value helpers**](#value-helpers): fallbacks, importance, and token expressions.
- [**Variables**](#variables): typed runtime values bound to static rules.
- [**Composition**](#composition): explicit overrides between generated styles.
- [**Stylesheets and compilation**](#stylesheets-and-compilation): global rules, animations, fonts, and web/native output.
- [**CLI**](#cli): standalone compilation with watch mode.

## Philosophy

- **Typed.** Properties, tokens, and variants carry their constraints into every call.
- **Standard.** Styles use familiar CSS properties, selectors, queries, and cascade behavior.
- **Agnostic.** The core is independent of frameworks, build tools, and environments.
- **Universal.** Shared definitions target web and native with explicit platform capabilities.
- **Minimal.** Small, composable APIs keep configuration and dependencies optional.
- **Compiled.** Rules compile ahead of time into compact output with readable class names on web.

## Overview

Pass a style object to `css` and use the result as a class name. Properties and tokens are inferred; styles compile into CSS ahead of time.

```tsx
import { css } from 'typestyle'

export function Button() {
  return (
    <button className={css({ color: 'blue.700', padding: 4 })}>Continue</button>
  )
}
```

## Features

### Styles

Use `css` with built-in tokens, inline or as an exported class string. Nest selectors and queries alongside declarations.

```tsx
import { css } from 'typestyle'

const button = css({
  color: 'blue.700',
  padding: 4,
  ':hover': { opacity: 0.8 },
})

<button className={button}>Continue</button>
```

### Themes

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

Describe component choices with inferred props, defaults, and compound rules. Web variants select styles through data attributes.

```tsx
import { Variant } from 'typestyle'

const button = Variant.define(theme, {
  base: { display: 'inline-flex' },
  variants: {
    size: {
      sm: { padding: 'sm' },
      md: { padding: 'md' },
    },
  },
  defaultVariants: { size: 'md' },
})

type ButtonProps = Variant.Props<typeof button>
;<button {...button({ size: 'sm' })}>Continue</button>
```

### Value helpers

Callbacks supply helpers for literal values, fallback declarations, importance, and expressions using theme tokens.

```ts
const panel = theme.css(({ fallback, important, value, tokens }) => ({
  display: fallback('block', 'grid'),
  color: important('brand'),
  width: value`calc(100% - ${tokens.spacing.md})`,
}))
```

### Variables

Bind runtime values to typed variables while keeping the CSS rules static.

```tsx
import { Var, css } from 'typestyle'

const progress = Var.define({ amount: 'percentage' })
const bar = css({ width: progress.amount })

<div className={bar} style={Var.set(progress, { amount: '50%' })} />
```

### Composition

Prefer state attributes for conditional styling. Use `cx` for explicit overrides between generated styles in matching selector and condition contexts.

```tsx
import { css, cx } from 'typestyle'

const base = css({ padding: 2 })
const roomy = css({ padding: 4 })

<button className={cx(base, roomy)}>Continue</button>
```

### Stylesheets and compilation

`Css` provides global rules, keyframes, fonts, and in-memory CSS compilation. Named `Style` definitions also feed the native compiler.

```ts
import { Style } from 'typestyle'
import * as Css from 'typestyle/css'

Css.global({ body: { margin: 0 } })

const styles = Style.define({
  card: { display: 'flex' },
})
const output = Css.compile({ styles })
```

```ts
import * as Native from 'typestyle/native'

const output = Native.compile({ styles, themes: { base: theme } })
const selected = Native.select(output.styles, {
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
