# From Tailwind

Migrate a Tailwind CSS v4 application to Zyzz while preserving its appearance and behavior. This guide follows Tailwind's [Core concepts](https://tailwindcss.com/docs/styling-with-utility-classes), with comparisons for configuration, component styles, and CSS delivery.

1. [Before Migrating](#before-migrating)
2. [Thinking In Zyzz](#thinking-in-zyzz)
3. [Migrate Setup](#migrate-setup)
4. [Utility Styles](#utility-styles)
5. [States And Selectors](#states-and-selectors)
6. [Responsive Design](#responsive-design)
7. [Dark Mode](#dark-mode)
8. [Theme Variables](#theme-variables)
9. [Colors](#colors)
10. [Custom Styles](#custom-styles)
11. [Source Detection](#source-detection)
12. [Functions And Directives](#functions-and-directives)
13. [Finish Migrating](#finish-migrating)

## Before Migrating

### Guide Scope

Examples use React and TypeScript. The CSS mappings also apply to other supported web frameworks, but applying generated props and connecting compilation depend on the framework. See [Compatibility](../introduction/compatibility.md) for integration limits. React Native requires a separate [native migration](native.md).

### Incremental Migration

Start with one component. Keep its existing colors, dimensions, fonts, states, and breakpoints. Adopt Zyzz's default theme or redesign shared tokens after the component renders correctly. Keep Tailwind available for components and dependencies that still require its generated CSS.

### Requirements And Limitations

Zyzz requires a build integration that processes its authoring source and delivers matching CSS. TypeScript checks properties, tokens, and inputs. Compilation checks extraction and selector grammar. Browser checks establish visual equivalence.

> [!NOTE]
> Inline Svelte authoring, Vue SFC integration, arbitrary imported records passed into `style(record)`, and raw dependency authoring are outside the verified web scope. Use supported source modules or precompiled packages as described in [Compatibility](../introduction/compatibility.md).

## Thinking In Zyzz

The introduction's [Thinking in Zyzz](../introduction/thinking-in-zyzz.md) describes the conventions behind the library. For a Tailwind component, those conventions change how styles are named, configured, and applied while keeping them beside the component.

### Co-Located Styles

Tailwind keeps styling in class strings within markup:

```tsx
export function Card() {
  return (
    <article className="grid gap-4 p-6">
      <h2 className="m-0 text-[1.25rem]">Account</h2>
    </article>
  )
}
```

Zyzz keeps the definitions in a module-level `namespace styles` in the same file. The markup applies named definitions:

```tsx
import { style } from 'zyzz'

namespace styles {
  export const card = style({
    display: 'grid',
    gap: '1rem',
    padding: '1.5rem',
  })

  export const title = style({ fontSize: '1.25rem', margin: 0 })
}

export function Card() {
  return (
    <article {...styles.card()}>
      <h2 {...styles.title()}>Account</h2>
    </article>
  )
}
```

These dimensions assume Tailwind's default `--spacing: 0.25rem`. A customized spacing variable requires corresponding values. The existing reset supplies the same heading and layout defaults during this first migration.

Shared definitions can move to an ordinary source module when several components need them. A separate style file is not required for each component.

### Named Composition

Tailwind commonly combines class strings through interpolation or a class helper. Zyzz combines applied definitions through `cx`:

```tsx
import { cx, style } from 'zyzz'

namespace styles {
  export const button = style({ borderRadius: '0.5rem', padding: '1rem' })

  export const focusRing = style({
    ':focus-visible': {
      outline: '2px solid currentColor',
      outlineOffset: '2px',
    },
  })
}

export function SaveButton() {
  return <button {...cx(styles.button(), styles.focusRing())}>Save</button>
}
```

`cx` retains generated classes, variable bindings, and variant attributes. Later conflicting generated declarations win under matching conditions, subject to importance. Multiple JSX spreads replace props, so `{...styles.button()} {...styles.focusRing()}` does not compose both definitions.

### Type Feedback

Tailwind tooling offers class completions. Zyzz's TypeScript contracts also constrain configured tokens, component choices, and runtime inputs at their call sites. Renaming a token or variant can identify affected callers through type errors.

Types complement compilation. They cannot prove that a selector matches the intended DOM or that two migrations render identically. Keep both compiler and browser checks.

### CSS Names

Translate `flex`, `rounded-lg`, and `hover:opacity-80` into `display`, `borderRadius`, and a `:hover` condition. CSS properties use camelCase. Values keep their CSS units and syntax. Selectors, inheritance, and cascade rules retain their CSS meaning.

Config-local [shorthands](themes.md#property-mappings) can name common property groups, but recreating the entire utility vocabulary is unnecessary. Start with standard properties and add aliases where they clarify repeated declarations.

### Explicit Configuration

Tailwind's stylesheet configures the utilities generated for that stylesheet. In Zyzz, the import selects the configuration:

| Import                          | Contract                                       |
| ------------------------------- | ---------------------------------------------- |
| `style` from `zyzz`             | CSS values without bundled tokens              |
| `style` from `./zyzz.config.js` | The application's configured tokens and layers |
| `style` from `zyzz/default`     | Zyzz's opt-in default tokens                   |

The default theme is not a Tailwind compatibility theme. Its colors use Geist scales, and its spacing omits fractional token paths. Preserve the existing values in an application config when visual equivalence matters.

### Component Variants

Replace repeated conditional class strings with a recipe that owns the choices:

```tsx
import { variants } from 'zyzz'

namespace styles {
  export const button = variants({
    base: { display: 'inline-flex' },
    defaultVariants: { size: 'regular' },
    variants: {
      size: {
        compact: { padding: '0.5rem' },
        regular: { padding: '1rem' },
      },
    },
  })
}

export function SaveButton() {
  return <button {...styles.button({ size: 'compact' })}>Save</button>
}
```

Tailwind calls prefixes such as `hover:` and `md:` variants. Those become CSS conditions in Zyzz. Zyzz's `variants` function instead defines component choices, defaults, and compound rules, similar to a component recipe built with a class-variance helper.

### Runtime Values

Both systems generate CSS before rendering. A Tailwind component often passes changing values through inline styles or CSS variables. Zyzz also supports typed callbacks that bind values to precompiled variable slots:

```tsx
import { style } from 'zyzz'

namespace styles {
  export const bar = style((values: { width: `${number}%` }) => ({
    width: values.width,
  }))
}

export function Bar({ width }: { width: `${number}%` }) {
  return <div {...styles.bar({ width })} />
}
```

The call changes the width without inserting a CSS rule. Finite choices belong in recipes. Per-instance values belong in callbacks or variables. Rule structure must remain statically analyzable.

## Migrate Setup

### Install Zyzz

```sh
pnpm add zyzz
```

Keep Tailwind installed until its remaining consumers have migrated. Check the selected integration's supported build-tool versions before changing the application setup.

### Configure Compilation

For [Vite](../introduction/vite.md), add the named plugin to the existing configuration. Keep the framework plugin and, during migration, the existing Tailwind integration:

```ts
import { defineConfig } from 'vite'
import { zyzz } from 'zyzz/vite'

export default defineConfig({
  plugins: [zyzz()],
})
```

The snippet shows only the Zyzz entry. The plugin transforms source and delivers its CSS. A PostCSS import alone cannot compile Zyzz definitions. For other builds, follow [Next.js](../introduction/next.md) or [CLI](../introduction/cli.md) setup.

> [!TIP]
> Start with [`zyzz/default`](../api/default.md) when a custom theme is unnecessary. It exports configured `style` and `variants` helpers with familiar spacing, radius, and breakpoint scales, plus Geist colors and typography. No `zyzz.config.ts` is required.
>
> ```tsx
> import { style } from 'zyzz/default'
>
> namespace styles {
>   export const card = style({
>     backgroundColor: 'surface',
>     borderRadius: 'lg',
>     color: 'foreground',
>     colorScheme: 'light dark',
>     display: 'grid',
>     gap: 4,
>     padding: 6,
>   })
>
>   export const title = style({ typography: 'heading.24' })
> }
>
> export function Card() {
>   return (
>     <article {...styles.card()}>
>       <h2 {...styles.title()}>Account</h2>
>     </article>
>   )
> }
> ```
>
> `padding: 6` selects `1.5rem`, like Tailwind's default `p-6`. Colors and typography differ from Tailwind's defaults. Use an [application config](#export-helpers) to preserve existing design tokens. The [build integration](#configure-compilation) is still required; fonts and resets remain explicit.

### Export Helpers

Move the values needed by migrated components into an explicit config. This example establishes the config used by later snippets importing `./zyzz.config.js`:

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export const { style, theme, variants } = Config.create({
  theme: {
    breakpoints: { md: '48rem' },
    color: { brand: '#2563eb' },
    spacing: { 2: '0.5rem', 4: '1rem', 6: '1.5rem' },
  },
})
```

Import helpers from that module to access those tokens. A filename alone does not install a global theme. See [Theme Variables](#theme-variables) for mapping `@theme` and preserving custom values.

### Stylesheets And Resets

Keep `@import "tailwindcss"` while existing components still use Tailwind. Its Preflight affects migrated components too. Avoid adding a second reset during the first component migration.

When Tailwind is removed, choose an application-owned reset or explicitly import Zyzz's optional reset:

```ts
import 'zyzz/reset.css'
```

The reset uses the `reset` layer and is not installed by core imports. Compare headings, lists, borders, form controls, images, and font inheritance before replacing Preflight. See [Optional Reset](stylesheets.md#optional-reset).

### Run Both Libraries

Separate components can keep their existing styling systems during migration. If one element needs both, pass its remaining classes to the Zyzz application rather than replacing the generated `className`:

```tsx
import { style } from 'zyzz'

namespace styles {
  export const button = style({ padding: '1rem' })
}

const example = (
  <button {...styles.button({ className: 'rounded-lg' })}>Save</button>
)
```

Avoid defining the same property in both systems on that element. External classes follow CSS precedence. Unlayered normal Zyzz declarations outrank layered normal utilities regardless of class-string order. Declare shared layer ordering deliberately when both systems participate in the same cascade.

## Utility Styles

### Typed Properties

The [utility-first workflow](https://tailwindcss.com/docs/styling-with-utility-classes) becomes named declarations. These mappings assume unmodified Tailwind defaults:

| Tailwind            | Zyzz Declaration                                                     |
| ------------------- | -------------------------------------------------------------------- |
| `flex items-center` | `display: 'flex', alignItems: 'center'`                              |
| `grid grid-cols-2`  | `display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'`  |
| `p-4`               | `padding: '1rem'`                                                    |
| `px-4`              | `paddingInline: '1rem'`                                              |
| `size-12`           | `width: '3rem', height: '3rem'`                                      |
| `rounded-lg`        | `borderRadius: '0.5rem'`                                             |
| `text-lg`           | `fontSize: '1.125rem', lineHeight: '1.75rem'`                        |
| `font-medium`       | `fontWeight: 500`                                                    |
| `truncate`          | `overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'` |

Check the complete CSS expansion of each utility. A font-size utility can also set line height. Preserve logical properties for utilities such as `px-*` and `ms-*`, including layouts with a different writing direction.

With the config above, `style({ padding: 4 })` selects its `spacing.4` token. A bare number is not universally a spacing multiplier. Without that configured scale, use an explicit CSS length such as `'1rem'`.

### Arbitrary Values

Remove utility syntax around one-off CSS values:

```html
<div class="grid grid-cols-[12rem_1fr] w-[calc(100%-2rem)]"></div>
```

```ts
import { style } from 'zyzz'

namespace styles {
  export const panel = style({
    display: 'grid',
    gridTemplateColumns: '12rem 1fr',
    width: 'calc(100% - 2rem)',
  })
}
```

Spaces remain ordinary spaces. CSS functions need valid CSS syntax. Arbitrary properties become supported camelCase properties. Standard custom properties can remain in ordinary CSS, or use [typed variables](#css-variables) when their definitions belong in Zyzz.

### CSS Variables

Existing references such as `bg-(--brand)` become `backgroundColor: 'var(--brand)'`. Keep the existing declaration of `--brand` until its consumers migrate.

For a reusable variable owned by Zyzz:

```tsx
import { style, variable } from 'zyzz'

namespace variables {
  export const accent = variable('color')
}

namespace styles {
  export const label = style({
    variables: { [variables.accent]: '#2563eb' },
    color: variables.accent,
  })
}

const example = (
  <span {...styles.label({ variables: { [variables.accent]: '#9333ea' } })}>
    Account
  </span>
)
```

Definitions emit static assignments. Applications bind per-element values. Computed assignment keys lose individual domain information in TypeScript; `variables.accent.set(value)` retains that check. See [variable](../api/core/variable.md).

### Conditional Styles

Move finite class alternatives into [component variants](#component-variants). Use `cx(styles.base(), enabled && styles.emphasis())` for supported conditional composition. Keep events, children, and accessibility props on the element.

`cx` requires compiler-resolved applications or supported immutable local props bindings. Ternary arguments and arbitrary external props are unsupported, and conditional composition accepts at most eight conditional arguments. It is not a general replacement for every `clsx` or `tailwind-merge` input.

### Dynamic Values

Replace dynamically constructed classes such as `w-[${width}%]` with the [typed width callback](#runtime-values). Keep calculations in application code and pass the result into the callback. The callback declares a fixed property structure, not an arbitrary runtime style factory.

For finite choices such as red or blue tone, declare both choices in a recipe and select by name. See [Dynamic Values](styling.md#dynamic-values) for supported scalar inputs and extraction restrictions.

### Reuse Styles

Loops and reusable components continue to avoid duplicated markup. Repeated styling treatments can become named definitions and compose with `cx`. Module-local literal records and spreads can share declarations within `namespace styles`.

Export compiled definitions when reuse crosses modules. Arbitrary imported object records passed into a new `style(record)` call remain unsupported. See [Share Styles](styling.md#share-styles).

### Resolve Conflicts

Tailwind's generated stylesheet order, not the order of classes in markup, resolves competing utilities. Zyzz's `cx` explicitly resolves conflicts between its generated applications. External classes still follow specificity, layers, importance, and rule order.

Tailwind's `text-red-500!` marks a utility important. Zyzz accepts a value suffix such as `color: '#ef4444 !important'`. Arrays such as `display: ['block', 'flex']` preserve fallback order, not responsive positions. Put responsive values inside explicit queries.

### Composite Utilities

Some utilities coordinate shared CSS variables. Combining separate Zyzz declarations for the same property would overwrite a value instead of reconstructing that composition:

| Tailwind Pattern        | Migration                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `blur-sm grayscale`     | Author the full filter, such as `filter: 'blur(8px) grayscale(100%)'` with default blur spacing          |
| Rings and shadows       | Preserve the complete `box-shadow` list, including ring offsets and inset behavior                       |
| Gradient stops          | Author the complete gradient and preserve its interpolation color space                                  |
| Transforms              | Preserve individual `translate`, `rotate`, and `scale` properties or the original ordered transform list |
| `space-x-*`, `divide-*` | Reproduce the child selectors and logical declarations; `gap` is only equivalent for appropriate layouts |

When a condition changes one part of a combined value, retain the other parts explicitly or use independent variables. See [Styling](styling.md) for composition and fallbacks.

## States And Selectors

### Pseudo Classes

Translate [state prefixes](https://tailwindcss.com/docs/hover-focus-and-other-states) into conditions. Tailwind's hover utility includes a hover-capability media query, so preserve it when matching behavior:

```html
<button class="hover:opacity-80 focus-visible:outline-2 disabled:opacity-50">
  Save
</button>
```

```ts
import { style } from 'zyzz'

namespace styles {
  export const button = style({
    ':disabled': { opacity: 0.5 },
    ':focus-visible': { outlineWidth: '2px', outlineStyle: 'solid' },
    '@media (hover: hover)': { ':hover': { opacity: 0.8 } },
  })
}
```

The same approach covers active, visited, checked, invalid, required, open, and structural states such as first, last, odd, and even. Preserve the actual HTML state, including `disabled`, `open`, and input attributes.

### Pseudo Elements

Use selectors such as `&::before`, `&::after`, `&::placeholder`, `&::selection`, `&::marker`, and `&::file-selector-button`. Unlike a Tailwind `before:` utility, a pseudo-element rule does not automatically add `content`:

```ts
import { style } from 'zyzz'

namespace styles {
  export const required = style({
    selectors: { '&::after': { content: '" *"', color: 'red' } },
  })
}
```

Tailwind's placeholder utilities can include an opacity reset, and marker or selection variants can include descendant selectors. Preserve those extra declarations or selectors when the original utility targets them.

### Stacked Conditions

Nested conditions combine with AND. For `md:hover:opacity-80`, place the hover rule inside both the breakpoint and hover-capability queries. For `disabled:hover:*`, nest `:hover` under `:disabled`, retaining the hover guard.

### Group And Peer

Replace marker classes with references to named style definitions. Apply the marker definition even when it has no declarations:

```tsx
import { style } from 'zyzz'

namespace styles {
  export const card = style()
  export const input = style()

  export const label = style({
    '@media (hover: hover)': {
      selectors: {
        [`:where(${card}):hover &`]: { textDecorationLine: 'underline' },
      },
    },
  })

  export const hint = style({
    selectors: { [`:where(${input}):invalid ~ &`]: { color: 'red' } },
  })
}

const example = (
  <section {...styles.card()}>
    <label {...styles.label()} htmlFor="email">
      Email
    </label>
    <input {...styles.input()} id="email" type="email" required />
    <p {...styles.hint()}>Enter an email address.</p>
  </section>
)
```

`group-hover` observes an ancestor. `peer-invalid` observes a preceding sibling, so DOM order still matters. Distinct definitions replace named groups and peers. Interpolate definitions without calling them. `:where(...)` prevents the marker identity from adding specificity.

### Child Selectors

For `*:` and `**:`, use `& > *` and `& *` under `selectors`. For nth-child conditions, use selectors such as `&:nth-child(3n + 1)`. Preserve specificity and cascade ordering when children also declare the affected property.

### Relational Selectors

Map `has-*`, `not-*`, `in-*`, and arbitrary relationships to ordinary selectors. For example, `has-checked:*` can use `&:has(:checked)`, while an ancestor's focus state can use `:focus &`. Reference named definitions when the relationship belongs to a particular component.

### Attribute Selectors

`data-[state=open]:*` becomes `&[data-state="open"]`; `aria-expanded:*` becomes `&[aria-expanded="true"]`. Boolean data attributes use presence selectors such as `&[data-active]`. Keep ARIA semantics and attribute updates in component code.

### Arbitrary Variants

Translate `[&>span]:underline` into `selectors: { '& > span': { textDecorationLine: 'underline' } }`. Every selector branch must contain `&`. Tailwind class escaping and underscore substitutions are unnecessary in selector strings. Compiler validation still applies.

Custom selector prefixes become explicit selectors or shared definitions, rather than a global variant registry. CSS specificity follows the authored selector. See [Style Relationships](conditions.md#style-relationships).

### Feature Queries

For `supports-[display:grid]:grid`, use `'@supports (display: grid)': { display: 'grid' }`. Negated feature checks use `@supports not (...)`. Breakpoints, selectors, and feature queries can nest when their conditions must all match.

### User Preferences

| Tailwind Variant          | CSS Condition                                    |
| ------------------------- | ------------------------------------------------ |
| `motion-reduce:`          | `@media (prefers-reduced-motion: reduce)`        |
| `motion-safe:`            | `@media (prefers-reduced-motion: no-preference)` |
| `contrast-more:`          | `@media (prefers-contrast: more)`                |
| `contrast-less:`          | `@media (prefers-contrast: less)`                |
| `forced-colors:`          | `@media (forced-colors: active)`                 |
| `pointer-coarse:`         | `@media (pointer: coarse)`                       |
| `pointer-fine:`           | `@media (pointer: fine)`                         |
| `any-pointer-coarse:`     | `@media (any-pointer: coarse)`                   |
| `any-pointer-fine:`       | `@media (any-pointer: fine)`                     |
| `portrait:`, `landscape:` | `@media (orientation: portrait)` or `landscape`  |
| `print:`                  | `@media print`                                   |
| `starting:`               | `@starting-style`                                |

Preserve inherited direction behavior for `rtl:` and `ltr:` with matching direction selectors. Preserve `inert:` coverage for both an inert element and its descendants. The browser determines support for these CSS features. See [At-Rules](../api/web/at-rules.md) for compiler grammar.

## Responsive Design

### Mobile First

Tailwind's [responsive prefixes](https://tailwindcss.com/docs/responsive-design) usually add minimum-width conditions. Unprefixed declarations remain the base styles:

```html
<div class="grid grid-cols-1 md:grid-cols-2"></div>
```

```ts
import { style } from './zyzz.config.js'

namespace styles {
  export const grid = style({
    display: 'grid',
    gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
    '@media md': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  })
}
```

The setup config defines `md` as `48rem`. Root `style` has no named breakpoints. Raw CSS queries such as `@media (width >= 48rem)` work without a theme. Keep the viewport meta tag in the document.

### Breakpoint Ranges

Use `@media (48rem <= width < 64rem)` for the default `md:max-lg:` range. Use `@media (width < 48rem)` for default `max-md:`. Preserve exclusive upper bounds rather than substituting an inclusive `max-width` that overlaps at the boundary.

### Custom Breakpoints

Move custom `--breakpoint-*` values into `theme.breakpoints`, keeping their original units. Aliases compile to literal query thresholds. Changing a runtime theme scope does not change those thresholds. Arbitrary `min-*` and `max-*` values can remain raw queries.

### Container Queries

Translate the container declaration and its query together:

```html
<aside class="@container/sidebar">
  <div class="grid grid-cols-1 @min-[24rem]/sidebar:grid-cols-2"></div>
</aside>
```

```tsx
import { style } from 'zyzz'

namespace styles {
  export const sidebar = style({
    containerName: 'sidebar',
    containerType: 'inline-size',
  })

  export const grid = style({
    display: 'grid',
    gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
    '@container sidebar (width >= 24rem)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
  })
}

const example = (
  <aside {...styles.sidebar()}>
    <div {...styles.grid()}>Content</div>
  </aside>
)
```

Named thresholds belong in `theme.containers`; declared names belong in `theme.containerNames`. Unnamed queries omit the name. Max and range queries retain their CSS bounds. Container-relative lengths such as `50cqw` remain CSS values. See [Responsive Styles](conditions.md#responsive-styles).

## Dark Mode

### System Preference

For Tailwind's default [dark mode](https://tailwindcss.com/docs/dark-mode), preserve the media condition directly:

```html
<div class="bg-white dark:bg-black"></div>
```

```ts
import { style } from 'zyzz'

namespace styles {
  export const panel = style({
    backgroundColor: 'white',
    '@media (prefers-color-scheme: dark)': { backgroundColor: 'black' },
  })
}
```

### Existing Selectors

If Tailwind uses `@custom-variant dark (&:where(.dark, .dark *))`, retain that exact selector under `selectors`. For a data-attribute switch, retain its corresponding selector. A system-preference media query alone does not preserve a manual toggle.

```ts
import { style } from 'zyzz'

namespace styles {
  export const panel = style({
    backgroundColor: 'white',
    selectors: {
      '&:where(.dark, .dark *)': { backgroundColor: 'black' },
    },
  })
}
```

### Paired Colors

After preserving existing behavior, repeated light/dark color pairs can become semantic tokens. This is an alternative config to the setup example:

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export const { appearance, script, style, theme } = Config.create({
  theme: {
    color: {
      foreground: { dark: '#fff', light: '#111' },
      surface: { dark: '#111', light: '#fff' },
    },
  },
})
```

```ts
import { style } from './zyzz.config.js'

namespace styles {
  export const panel = style({
    backgroundColor: 'surface',
    color: 'foreground',
  })
}
```

Pairs compile to `light-dark()` and follow the element's effective `color-scheme`. Declare `color-scheme: light dark` on the root to follow system preference. A `.dark` class alone does not set the scheme. Keep explicit conditions for layout, visibility, shadows, and other non-color changes.

### Explicit Selection

The paired-color config exports `appearance`. `appearance.set({ colorScheme: 'dark' })` updates and persists the root scheme; `'light dark'` restores system preference. `appearance.get()` reads the applied state. Import it from the same config as the styles.

Named theme catalogs can select a subtree with `themes({ theme: 'base', colorScheme: 'dark' })`. Theme selection and color scheme are separate choices. See [Color Schemes](themes.md#color-schemes).

### Persist Preferences

Existing Tailwind toggle code can stay while selector-based dark styles remain. When switching to Zyzz controls, migrate stored preferences explicitly. Zyzz's default `zyzz` record contains `theme` and/or `colorScheme`; an existing `theme: 'dark'` string in another record is not automatically converted.

### Prevent Flashes

Set the initial root scheme and restore saved preferences before visible content paints. Vite injects the config's initialization script by default. Other integrations can render `script()` early in the document head, with a CSP nonce when required. Follow [Restore Preferences](themes.md#restore-preferences) for hydration and storage behavior.

## Theme Variables

### Theme Configuration

Tailwind's [`@theme`](https://tailwindcss.com/docs/theme) defines utility tokens. Zyzz binds tokens to the exported helpers:

```css
@theme {
  --color-brand: #2563eb;
  --spacing-gutter: 1.5rem;
  --breakpoint-md: 48rem;
}
```

```ts
import { Config } from 'zyzz'

export const { style, theme } = Config.create({
  theme: {
    breakpoints: { md: '48rem' },
    color: { brand: '#2563eb' },
    spacing: { gutter: '1.5rem' },
  },
})
```

`bg-brand p-gutter` becomes `style({ backgroundColor: 'brand', padding: 'gutter' })` using that configured helper. Nested palettes use dotted paths, such as `blue.500`. CSS literals win when they collide with token names; use `theme.tokens` to reference such a token explicitly.

### Token Mappings

| Tailwind Namespace                                                     | Zyzz Group                                                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `--color-*`                                                            | `color`, with optional property-specific `backgroundColor`, `borderColor`, and `textColor`            |
| `--spacing-*`                                                          | `spacing`, with optional `margin` and `padding` groups                                                |
| `--font-*`                                                             | `fontFamily`                                                                                          |
| `--text-*`                                                             | `fontSize`; accompanying line-height, weight, and tracking require explicit fields or typography sets |
| `--font-weight-*`                                                      | `fontWeight`                                                                                          |
| `--tracking-*`                                                         | `letterSpacing`                                                                                       |
| `--leading-*`                                                          | `lineHeight`                                                                                          |
| `--radius-*`                                                           | `borderRadius`                                                                                        |
| `--breakpoint-*`                                                       | `breakpoints`                                                                                         |
| `--container-*`                                                        | `containers` for queries; copy sizing values separately for width declarations                        |
| `--shadow-*`, `--inset-shadow-*`, `--drop-shadow-*`, `--text-shadow-*` | CSS values or independent variables                                                                   |
| `--blur-*`, `--perspective-*`, `--ease-*`, `--animate-*`               | CSS values, independent variables, or keyframes                                                       |

Tailwind's scalar `--spacing` generates multiples. Zyzz's spacing groups contain explicit values. Define the required steps or preserve a CSS expression such as `calc(var(--spacing) * 4)`, retaining the variable's declaration. Fractional Tailwind steps can use semantic token names or literal CSS lengths.

### Extend Themes

Use `Theme.define` for a reusable base and `Theme.extend` for compatible overrides:

```ts
import { Config, Theme } from 'zyzz'

const base = Theme.define({
  color: { brand: '#2563eb' },
  spacing: { gutter: '1.5rem' },
})
const roomy = Theme.extend(base, { spacing: { gutter: '2rem' } })

export const { style, theme } = Config.create({ theme: roomy })
```

`Theme.extend` changes existing paths while retaining their contract. Add new paths to the base definition when designing a shared contract. It is not an unrestricted merge of arbitrary new token groups. See [Theme.extend](../api/core/Theme/extend.md).

### Replace Defaults

A custom `Config.create({ theme })` does not implicitly include Zyzz defaults. Define the intended token groups directly. This replaces Tailwind's namespace-reset patterns such as `--color-*: initial` or `--*: initial` without requiring wildcard reset syntax.

Import `style` from `zyzz/default` only when its values are intentional. Importing default helpers elsewhere does not change application-bound helpers.

### Share Themes

Export a `Theme.define` value from a shared module and import it into application configs. Components import the resulting helpers. Published theme packages need matching compiler metadata; see [Shared Configuration](themes.md#shared-configuration) and [Publish Libraries](compilation.md#publish-libraries).

### Inline Themes

Tailwind's `@theme inline` can make utilities use a referenced variable directly. Preserve that variable reference in the Zyzz declaration, such as `fontFamily: 'var(--font-app)'`, while keeping its declaration and scope. Do not assume introducing a generated theme variable preserves the same inherited-variable resolution.

### Static Variables

Tailwind's `@theme static` requests variables even when utilities do not use them. Zyzz emits used theme tokens and has no equivalent all-token emission flag. Keep an explicit application-owned CSS variable stylesheet when external CSS or scripts require stable, always-present variable names.

### Variable References

Use `theme.tokens.spacing[4]` for a typed token reference and `theme.vars.spacing[4]` in a web CSS expression:

```ts
import { style, theme } from './zyzz.config.js'

namespace styles {
  export const panel = style({
    padding: theme.tokens.spacing[4],
    width: `calc(100% - ${theme.vars.spacing[4]})`,
  })
}
```

This snippet uses the [setup config](#export-helpers). References follow compatible theme scopes. They are not runtime setters or measurements. If JavaScript needs a resolved CSS value, read it from the relevant element with the browser's computed-style APIs.

### Theme Scopes

Configure `themes` and `defaultTheme` for named compatible alternatives, then apply `themes({ theme: 'mint' })` to a document or subtree. The selection changes inherited token values while components retain their style definitions. Independently defined themes do not share a contract solely because their keys match.

See [Selecting a Theme](themes.md#selecting-a-theme) for a complete catalog. Breakpoint and container thresholds remain compile-time metadata and do not change with runtime scopes.

### Unsupported Groups

Zyzz's theme contract does not contain every Tailwind namespace. Shadows, blur, easing, animation, and perspective should remain CSS values or independently declared variables. Use `keyframes` for named animation rules. An unsupported theme group should not be added to `Config.create` merely to preserve its Tailwind name.

## Colors

### Preserve Palettes

Copy the application's actual [color values](https://tailwindcss.com/docs/colors) into its theme, including custom overrides. `bg-blue-500` can become `backgroundColor: 'blue.500'` only when that configured token contains the intended value. Preserve OKLCH values when matching a Tailwind palette rather than substituting approximate hex colors.

### Default Differences

`zyzz/default` uses Geist light/dark scales with steps from `100` to `1000`, plus semantic colors. Tailwind's palette names, steps, and values differ. The same-looking token name does not establish visual equivalence. See [Default Config](../api/default.md).

### Semantic Colors

After migrating literal palettes, names such as `surface` and `foreground` can describe component roles. [Paired Colors](#paired-colors) can replace repeated light/dark color declarations. This is a design change when the new values differ from the previous palette.

### Color Opacity

Preserve color alpha separately from element opacity. For Tailwind `bg-brand/50`, use a CSS mix referencing the configured brand:

```ts
import { style, theme } from './zyzz.config.js'

namespace styles {
  export const panel = style({
    backgroundColor: `color-mix(in oklab, ${theme.vars.color.brand} 50%, transparent)`,
  })
}
```

`opacity: 0.5` would also fade text, borders, and descendants. Arbitrary alpha values use the corresponding percentage. Keep any existing alpha within the base color when preserving its resulting opacity.

### Arbitrary Colors

`bg-[#316ff6]` becomes `backgroundColor: '#316ff6'`. Supported CSS color functions remain values. A runtime brand color can use a typed callback or a color variable; a dynamically constructed utility name is unnecessary.

### Inherited Colors

`text-current`, `border-current`, and `fill-current` become the corresponding properties with `'currentColor'`. `inherit` and `transparent` remain CSS values. Existing named custom properties use `var(--name)` until their consumers and declarations are migrated together.

## Custom Styles

### Global Styles

Keep ordinary CSS where it already fits. For [custom styles](https://tailwindcss.com/docs/adding-custom-styles) owned by Zyzz, use `global` for document selectors and `style` for a component's named definitions:

```ts
import { global } from 'zyzz/web'

global({
  '@layer base': {
    body: { margin: 0 },
    h1: { fontSize: '2rem' },
  },
})
```

Global declarations are collected eagerly from eligible project source, including beside lazy components. Their rules do not wait for a component to render. Existing CSS modules can remain CSS modules when they no longer depend on Tailwind directives.

### Cascade Layers

Declare layer order once and place rules in the intended layer:

```ts
import { Config } from 'zyzz'

export const { style } = Config.create({
  layers: ['reset', 'base', 'components', 'utilities'],
})

namespace styles {
  export const panel = style({
    '@layer components': { padding: '1rem' },
  })
}
```

During coexistence, reconcile this order with Tailwind's stylesheet prelude, including its `theme` layer. Import order alone cannot correct conflicting layer declarations. Normal unlayered rules outrank layered rules; important declarations reverse layer precedence.

### Component Styles

Replace a component class built with `@apply` by a named `style` or `variants` definition. Preserve all declarations contributed by the applied utilities. For third-party markup that cannot accept generated props, retain an ordinary selector in CSS or `global`.

### Custom Utilities

`@utility` definitions become reusable styles, property aliases, or plain CSS depending on their purpose. A functional utility that reads `--value()` or `--modifier()` has no direct registration equivalent. Model finite options with recipe choices and per-instance scalar values with typed callbacks.

```ts
import { style, variants } from 'zyzz'

namespace styles {
  export const tabular = style({ fontVariantNumeric: 'tabular-nums' })
  export const tabSize = variants({
    variants: {
      spaces: {
        compact: { tabSize: 2 },
        regular: { tabSize: 4 },
      },
    },
  })
}
```

Preserve negative values and fractions explicitly, including any calculations the original utility performed. See [Property Mappings](themes.md#property-mappings) for config-local aliases that expand into several standard properties.

### Custom Variants

Translate `@variant` blocks into their actual selector or query condition. Translate `@custom-variant` definitions into reusable styling definitions or explicit selectors. A named theme selector may fit theme scopes, but an arbitrary application-state selector is not automatically a theme.

### Fonts And Animations

Move font declarations and keyframe rules through stylesheet helpers where appropriate:

```ts
import { style } from 'zyzz'
import { keyframes } from 'zyzz/web'

const enter = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })

namespace styles {
  export const notice = style({
    animationDuration: '160ms',
    animationFillMode: 'both',
    animationName: enter,
    animationTimingFunction: 'ease-out',
    '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
  })
}
```

For `animate-*`, retain the complete duration, easing, delay, iteration, direction, and fill behavior. Use `fontFace` or existing CSS for font loading. A `fontFamily` token selects a font but does not fetch it. See [Fonts and Motion](stylesheets.md#fonts-and-motion).

### External Styles

Ordinary stylesheet imports, CSS modules, and component library CSS can remain. Replace Tailwind-specific `@apply`, `@variant`, and `@reference` usage before removing their compiler. Stable application-owned custom properties can bridge retained CSS and migrated components.

### Plugin Styles

Tailwind plugins do not execute inside Zyzz. Inventory their emitted selectors, variables, base rules, utilities, and variants. Rewrite those behaviors or keep their precompiled CSS with its dependencies. A typography plugin's descendant rules, for example, are not replaced by setting only `fontSize` and `lineHeight`.

## Source Detection

### Compilation Model

Tailwind [detects utility strings](https://tailwindcss.com/docs/detecting-classes-in-source-files). Zyzz analyzes supported JavaScript and TypeScript definitions, resolves their imports, and emits matching code and CSS. An import of configuration alone does not compile application source.

The build adapter owns source discovery. Configuration passed to `Config.create` describes styling contracts, not Tailwind-style content globs.

### Source Roots

There is no direct Zyzz `@source` directive. With Vite, authoring lives in eligible physical source under the Vite root. The standalone CLI and file host have their own root and output settings. Choose those settings through the selected integration, not a CSS import modifier.

### Source Exclusions

`@source not`, `source(none)`, and per-stylesheet scanning configurations do not translate into invented `include` or `exclude` options on the Zyzz Vite plugin. Its discovery excludes tests, generated output, and raw dependency authoring. See [Vite Setup](../introduction/vite.md) and [Host.create](../api/node/Host/create.md) for the actual boundaries.

For multiple Tailwind entry stylesheets, plan each entry's CSS delivery through the bundler. Do not assume a source-scan boundary is equivalent to a route or chunk boundary. Globals are eager, while the integration controls component CSS splitting.

### Safelisted Styles

Replace `@source inline(...)` lists and brace expansions with explicit static definitions or finite recipe choices. Keep the definitions in the supported compilation graph. No string safelist is required to select a compiled recipe choice at runtime.

If a CMS emits arbitrary Tailwind class strings, migrating the surrounding component does not replace that contract. Convert CMS data into controlled recipe inputs or retain the required stylesheet. Excluding generated utilities with `@source not inline(...)` likewise requires reviewing which definitions the application still needs.

### Dynamic Classes

Do not build style definitions from arbitrary runtime expressions. Static recipe choices replace dynamic class-name fragments; callbacks bind scalar values. Both cases keep the set of CSS rules fixed. Definitions for arbitrary new rules cannot be generated by a runtime string.

### Monorepo Sources

Moving a Tailwind `@source "../shared"` path into a Zyzz config is insufficient. Shared source must fit the chosen adapter's boundaries, or be compiled as a package. Vite does not generally extract raw authoring outside its root. Verify the workspace's actual import and build path.

### External Packages

Precompiled components ship matching JavaScript and CSS. Packages exposing authoring contracts additionally ship adjacent `.zyzz.json` metadata. Vite consumes that metadata without executing the package's theme code. Follow [Theme Libraries](../introduction/vite.md#theme-libraries), including dependency-optimization exclusions when required.

Scanning a Tailwind-based dependency cannot turn it into a Zyzz package. Keep its required Tailwind CSS until the dependency itself offers a compatible build or is replaced.

### Authoring Restrictions

Use supported static imports, literals, local immutable records, and annotated scalar callbacks. Arbitrary build-time application execution is not part of extraction. Keep styles in supported source modules for frameworks whose inline syntax is not supported. See [Source Extraction](../api/compiler/Source/extract.md).

## Functions And Directives

### Directive Reference

This table covers the [Tailwind directives](https://tailwindcss.com/docs/functions-and-directives) used by the v4 migration. Each entry points to its replacement workflow. Zyzz does not parse these Tailwind directives.

| Tailwind                                         | Migration                                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `@import "tailwindcss"`                          | [Build integration and reset](#migrate-setup); ordinary CSS imports can remain                              |
| `@theme`                                         | [Theme configuration](#theme-configuration)                                                                 |
| `@theme inline`                                  | [Preserve variable resolution](#inline-themes)                                                              |
| `@theme static`                                  | [Explicit variable stylesheet](#static-variables) when unused names must remain present                     |
| `@source`, `source(...)`                         | [Integration source roots](#source-roots)                                                                   |
| `@source not`, `source(none)`                    | [Source boundaries](#source-exclusions), without direct plugin-option parity                                |
| `@source inline(...)`, `@source not inline(...)` | [Static definitions and choices](#safelisted-styles)                                                        |
| `@utility`                                       | [Reusable styles or aliases](#custom-utilities)                                                             |
| `@variant`, `@custom-variant`                    | [CSS selectors and queries](#custom-variants)                                                               |
| `@apply`                                         | [Named definitions or global rules](#component-styles)                                                      |
| `@reference`                                     | Import configured helpers for Zyzz source; [remove Tailwind directives](#external-styles) from retained CSS |
| `@plugin`                                        | [Migrate emitted styles](#plugin-styles); Tailwind plugins do not run inside Zyzz                           |

CSS subpath imports remain the responsibility of the CSS toolchain. JavaScript imports of config and style modules follow the selected integration's module resolution. An existing CSS alias is not automatically a Zyzz configuration import.

### Function Reference

| Tailwind                  | Migration                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `--alpha(color / amount)` | [`color-mix()`](#color-opacity) with the intended color space and alpha                |
| `--spacing(n)`            | A configured spacing token or `calc()` over a retained base variable                   |
| `--value(...)`            | [Static recipe choices or typed callback inputs](#custom-utilities)                    |
| `--modifier(...)`         | Explicit recipe choices or inputs, with defaults and validation owned by the component |

Ordinary CSS functions such as `calc()`, `min()`, `max()`, and `clamp()` remain CSS values where supported. Tailwind's build-time functions do not pass through to the browser or Zyzz unchanged.

## Finish Migrating

### Verify Appearance

Compare the migrated component against the existing version with the same content, viewport, fonts, and reset. Check computed spacing, typography, borders, colors, and multi-part effects. Token-name similarity is not evidence of equal values.

### Verify Interactions

Check keyboard focus, disabled and invalid controls, hover-capable and touch inputs, application attributes, and group/peer relationships. Exercise recipe choices and runtime values. Verify reduced-motion behavior where animations exist.

### Verify Responsiveness

Check below, at, and above each breakpoint, plus container query boundaries. Include the writing directions used by the application. Confirm range boundaries and layout overflow.

### Verify Themes

Check light, dark, and system modes, nested scopes, persisted preferences, and initial paint. Verify that retained Tailwind components and migrated components agree on the active theme during coexistence.

### Production Builds

Run the application's type checks and production build. Confirm CSS delivery on initial loads and lazy routes, including published components. A development render alone does not establish production stylesheet coverage.

### Server Rendering

Load server-rendered pages directly and verify styling before hydration. Server and client need matching compiled identities and theme selection. See [Server Rendering](compilation.md#server-rendering) for delivery requirements.

### Remove Tailwind

After remaining consumers have migrated, remove Tailwind's stylesheet import, build plugin, dependencies, and unused directives. Keep unrelated CSS processing. Replace Preflight deliberately and recheck appearance. Search retained CSS and third-party dependencies for Tailwind requirements before considering the migration complete.
