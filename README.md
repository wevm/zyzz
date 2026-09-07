# typestyle

A type-safe styling library for agents. Familiar CSS, inferred design tokens, and small APIs make styles straightforward to generate, inspect, and change.

- [**Typed Styles**](#typed-styles): typed CSS properties, values, selectors, and queries.
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

### Themes

Import a bundled theme's `css` for inferred design tokens. `typestyle/themes/default` also exports the full `theme` and raw `tokens` for extension and reuse.

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

These tables compare API and output models. DX means developer experience; AX means agent experience. Third-party integrations and optional packages are identified where relevant.

### Authoring and Integration

| Topic                 | typestyle                                                 | [Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes)                                                                          | [StyleX](https://stylexjs.com/docs/learn/thinking-in-stylex/)                                                               | [vanilla-extract](https://vanilla-extract.style/)                                                                             |
| --------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Authoring             | Inline or exported CSS objects                            | Utility strings in markup                                                                                                                      | `create` objects and `props`/`attrs`                                                                                        | Exported styles from `.css.ts` modules                                                                                        |
| Types and DX          | Inferred properties, token domains, and variants          | Class strings; [editor completion](https://tailwindcss.com/docs/editor-setup)                                                                  | Typed properties, variables, and style-prop contracts                                                                       | Typed CSS; configurable token utilities with [Sprinkles](https://vanilla-extract.style/documentation/packages/sprinkles/)     |
| Default Tokens        | Token-free core; opt-in bundled theme                     | [Bundled theme, configurable or removable](https://tailwindcss.com/docs/theme)                                                                 | Application-defined variables                                                                                               | Application-defined themes                                                                                                    |
| Themes and Schemes    | CSS variables; light/dark color pairs                     | CSS variables and `dark:` conditions                                                                                                           | [`defineVars` and conditional values](https://stylexjs.com/docs/learn/theming/defining-variables/); `createTheme` overrides | [`createTheme` contracts](https://vanilla-extract.style/documentation/api/create-theme/) and CSS condition overrides          |
| Selectors and Queries | CSS selectors; inferred media/container aliases           | State, responsive, container, and arbitrary variants                                                                                           | Property conditions; [`defineConsts` query references](https://stylexjs.com/docs/api/javascript/defineConsts/)              | [Selectors and queries](https://vanilla-extract.style/documentation/styling/); named Sprinkles conditions                     |
| Component Variants    | `Variant.define`; data attributes, defaults, compounds    | Application composition of utility classes                                                                                                     | [Style maps and conditional composition](https://stylexjs.com/docs/learn/recipes/variants/)                                 | Optional [Recipes](https://vanilla-extract.style/documentation/packages/recipes/) with defaults and compounds                 |
| Overrides             | `cx`: later generated styles win within matching contexts | Stylesheet order; class-string order does not resolve conflicts                                                                                | Later same-property styles win; specific longhands win by default                                                           | [Build-time composition](https://vanilla-extract.style/documentation/style-composition/); combined classes retain CSS cascade |
| Fallbacks and Escapes | `c.fallback`, `c.important`, and CSS strings              | Arbitrary values/properties and `!` modifier                                                                                                   | [`firstThatWorks`](https://stylexjs.com/docs/learn/styling-ui/defining-styles/#fallback-styles)                             | [Fallback arrays](https://vanilla-extract.style/documentation/styling/#fallback-styles) and CSS strings                       |
| Runtime Values        | `Vars.set` binds typed variables                          | Inline styles or CSS variable assignments                                                                                                      | [Dynamic functions bind CSS variables](https://stylexjs.com/docs/learn/styling-ui/defining-styles/#dynamic-styles)          | [`assignInlineVars` / `setElementVars`](https://vanilla-extract.style/documentation/packages/dynamic/)                        |
| AX Feedback           | Public types, compiler diagnostics, readable classes      | Recognizable utilities; complete class names must be [statically discoverable](https://tailwindcss.com/docs/detecting-classes-in-source-files) | Typed objects, compile constraints, and [LLM resources](https://stylexjs.com/docs/llm-resources)                            | Typed module exports and compiler feedback                                                                                    |
| Platform Boundary     | Web `Css`; explicit React Native `StyleSheet` subset      | Web CSS; native through separate integrations                                                                                                  | Framework-independent web CSS                                                                                               | Framework-independent web CSS                                                                                                 |
| Build and Libraries   | Pure compiler, CLI, optional adapters; modules plus CSS   | [CLI](https://tailwindcss.com/docs/installation/tailwind-cli) and build integrations; CSS output                                               | [CLI](https://stylexjs.com/docs/learn/installation/cli/) and build integrations; transformed modules plus CSS               | Build integrations; [Rollup recommended for libraries](https://vanilla-extract.style/documentation/integrations/vite/)        |

### Performance and Bundle Size

| Topic             | typestyle                                                           | Tailwind                                            | StyleX                                                                                                                                      | vanilla-extract                                                                                                   |
| ----------------- | ------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| CSS Generation    | Ahead of time                                                       | Ahead of time                                       | Ahead of time                                                                                                                               | Ahead of time                                                                                                     |
| Output Strategy   | Ordered rules with safe deduplication                               | Reusable utilities found in source                  | Atomic rules                                                                                                                                | Scoped rules; optional atomic Sprinkles                                                                           |
| Styling Runtime   | Static calls compile away; optional selection, binding, composition | No styling JavaScript required for utilities        | [Local calls can compile away; cross-file/dynamic composition can retain runtime work](https://stylexjs.com/docs/learn/thinking-in-stylex/) | Static CSS has no style-generation runtime; Recipes/Sprinkles/dynamic usage can retain helpers                    |
| Class Names       | Readable names with collision suffixes                              | Readable utility names                              | Generated identifiers                                                                                                                       | [Short, debug, or custom identifiers](https://vanilla-extract.style/documentation/integrations/vite/#identifiers) |
| Bundle Accounting | CSS, class strings, used helpers/metadata                           | CSS and class strings; optional application helpers | CSS, class strings, retained mappings and helpers                                                                                           | CSS, class strings, optional utility/recipe/dynamic helpers                                                       |

There are no matched speed or byte-size results published here. Compare equivalent rendered fixtures, including raw/gzip/Brotli CSS, generated JavaScript, markup, and required helpers. Measure cold builds, incremental edits, and browser style recalculation separately; atomic output alone does not establish a performance winner.
