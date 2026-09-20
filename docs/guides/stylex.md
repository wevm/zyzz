# Migrating from StyleX

Migrate a StyleX application to Zyzz while preserving its appearance and behavior. This guide maps StyleX's [styling](https://stylexjs.com/docs/learn/styling-ui/defining-styles/) and [theming](https://stylexjs.com/docs/learn/theming/defining-variables/) APIs to Zyzz, covering setup, component styles, and CSS delivery.

1. [Before Migrating](#before-migrating)
2. [Thinking In Zyzz](#thinking-in-zyzz)
3. [Migrate Setup](#migrate-setup)
4. [Define Styles](#define-styles)
5. [Compose Styles](#compose-styles)
6. [States And Queries](#states-and-queries)
7. [Component Variants](#component-variants)
8. [Dynamic Values](#dynamic-values)
9. [Vars And Themes](#variables-and-themes)
10. [Stylesheets And Delivery](#stylesheets-and-delivery)
11. [API Reference](#api-reference)
12. [Finish Migrating](#finish-migrating)

## Before Migrating

### Guide Scope

Examples use React and TypeScript with StyleX's build integration already configured. Each example is independent unless it names a shared config or variable module. Other web frameworks need their own prop application and build setup. See [Compatibility](../introduction/compatibility.md) for supported integrations.

### Incremental Migration

Start with one component and retain its CSS values, DOM structure, states, and theme scopes. Keep StyleX's compiler and stylesheet delivery for remaining consumers. Changing tokens, resets, or component APIs at the same time makes visual differences harder to diagnose.

### Requirements And Limitations

Zyzz requires source compilation and matching CSS delivery. A successful TypeScript check does not establish that a definition can be extracted or that its selectors match the intended elements. Run the application build and compare rendered behavior.

> [!NOTE]
> Arbitrary style objects passed through component props are not a direct migration to `cx`. Composition requires compiler-resolved applications. See [Component Boundaries](#component-boundaries) before migrating a shared component API based on `StyleXStyles`.

## Thinking In Zyzz

Both libraries keep style definitions beside components and compile CSS before rendering. Zyzz applies each definition as a callable, groups related definitions in a TypeScript namespace, and keeps configuration explicit through imports. See [Thinking in Zyzz](../introduction/thinking-in-zyzz.md).

### Co-Located Styles

StyleX defines a map with `create` and applies its entries with `props`:

```tsx
import * as stylex from '@stylexjs/stylex'

const styles = stylex.create({
  card: { display: 'grid', gap: 16, padding: 24 },
  title: { fontSize: 20, margin: 0 },
})

export function Card() {
  return (
    <article {...stylex.props(styles.card)}>
      <h2 {...stylex.props(styles.title)}>Account</h2>
    </article>
  )
}
```

Zyzz defines each style separately and calls it at the element:

```tsx
import { style } from 'zyzz'

namespace styles {
  export const card = style({
    display: 'grid',
    gap: '16px',
    padding: '24px',
  })

  export const title = style({ fontSize: '20px', margin: 0 })
}

export function Card() {
  return (
    <article {...styles.card()}>
      <h2 {...styles.title()}>Account</h2>
    </article>
  )
}
```

The explicit lengths preserve the original dimensions. Keep the existing font loading and reset while comparing the two components.

### Explicit Configuration

| Import                          | Contract                             |
| ------------------------------- | ------------------------------------ |
| `style` from `zyzz`             | CSS values without bundled tokens    |
| `style` from `./zyzz.config.js` | Application tokens and configuration |
| `style` from `zyzz/default`     | Zyzz's opt-in default tokens         |

StyleX variable names and values do not automatically become Zyzz tokens. Start with CSS literals or a custom config that preserves the existing values. Adopting `zyzz/default` changes the available design tokens and can change appearance.

### Static Rules, Runtime Inputs

Finite choices belong in `variants` or conditional composition. Per-instance values belong in typed callbacks or variables. Neither requires inserting CSS rules at render time. Rule structure must remain statically analyzable.

## Migrate Setup

### Install Zyzz

```sh
pnpm add zyzz
```

Keep StyleX installed until all application and dependency consumers have migrated. Check the chosen integration's supported versions before changing the build.

### Configure Compilation

For [Vite](../introduction/vite.md), add the named plugin to the existing configuration:

```ts
import { defineConfig } from 'vite'
import { zyzz } from 'zyzz/vite'

export default defineConfig({
  plugins: [zyzz()],
})
```

This snippet shows only the Zyzz entry. Retain the framework plugin and StyleX integration during migration. For other builds, follow [Next.js](../introduction/next.md) or [CLI](../introduction/cli.md) setup. Importing `style` alone does not install a compiler or load generated CSS.

### Preserve Existing CSS

Keep application stylesheets, fonts, resets, and third-party CSS. Zyzz's reset is optional and requires an explicit `import 'zyzz/reset.css'`. Adding it during migration can change elements that were previously styled only by browser defaults or application CSS.

### Run Both Libraries

Prefer migrating a complete element's styles together. If one element temporarily needs both systems, pass StyleX's `className` and `style` as styling overrides. Keep any other generated props on the element:

```tsx
import * as stylex from '@stylexjs/stylex'
import { style } from 'zyzz'

const legacy = stylex.create({
  button: { borderRadius: 8 },
})

namespace styles {
  export const button = style({ padding: '16px' })
}

export function SaveButton() {
  const { className, style, ...props } = stylex.props(legacy.button)

  return (
    <button {...props} {...styles.button({ className, style })}>
      Save
    </button>
  )
}
```

Avoid assigning the same property in both systems on that element. Zyzz treats external classes as ordinary CSS. Neither `cx` nor `stylex.props` resolves cross-library conflicts. Specificity, layers, importance, and stylesheet order still apply.

## Define Styles

### Properties And Units

Keep camelCase CSS property names. Convert numeric dimensions to explicit CSS lengths when preserving StyleX's pixel values:

| StyleX declaration | Token-free Zyzz declaration |
| ------------------ | --------------------------- |
| `padding: 16`      | `padding: '16px'`           |
| `fontSize: 14`     | `fontSize: '14px'`          |
| `margin: 0`        | `margin: 0`                 |
| `opacity: 0.8`     | `opacity: 0.8`              |
| `lineHeight: 1.5`  | `lineHeight: 1.5`           |
| `width: '50%'`     | `width: '50%'`              |

Numbers are not a universal pixel shorthand in Zyzz. A configured spacing number can select a token instead. For example, `padding: 4` from `zyzz/default` selects `1rem`, not `4px`. Keep unitless numbers for properties that accept them and use explicit units for dimensions.

### Fallback Values

StyleX's [`firstThatWorks`](https://stylexjs.com/docs/api/javascript/firstThatWorks/) lists the preferred value first. Zyzz arrays follow CSS declaration order, with the preferred supported value last:

```ts
import * as stylex from '@stylexjs/stylex'

const legacy = stylex.create({
  label: { color: stylex.firstThatWorks('oklch(60% 0.2 250)', '#2563eb') },
})
```

```ts
import { style } from 'zyzz'

namespace styles {
  export const label = style({
    color: ['#2563eb', 'oklch(60% 0.2 250)'],
  })
}
```

Arrays are fallbacks, not responsive positions. Put responsive declarations under explicit queries.

### Removing Declarations

StyleX can [unset a previously applied property](https://stylexjs.com/docs/learn/styling-ui/using-styles/#unsetting-styles) with `null`. Do not translate that operation into `color: null` or automatically substitute `unset` in Zyzz. CSS-wide keywords emit declarations and can produce a different cascade result.

Split the removable declaration from the base and apply it conditionally, or make it an optional recipe choice. In a Zyzz recipe, a `null` selection suppresses that choice and its default. It does not erase a declaration already present in the recipe's base.

### Static Source

Keep definitions at module scope. Zyzz supports local literal constants and supported spreads, but does not evaluate arbitrary application functions to discover CSS. Imported configurations and definitions require the graph-aware build integration. See [Static Bindings](styling.md#static-bindings) and [Source Extraction](../api/compiler/Source/extract.md).

## Compose Styles

### Ordered Composition

Replace a [StyleX composition](https://stylexjs.com/docs/learn/styling-ui/using-styles/#merging-styles) of named styles with `cx` over applied Zyzz definitions:

```tsx
import { cx, style } from 'zyzz'

namespace styles {
  export const base = style({ color: '#111', padding: '8px' })
  export const selected = style({ color: '#2563eb' })
}

export function Label({ selected }: { selected: boolean }) {
  return (
    <span {...cx(styles.base(), selected && styles.selected())}>Account</span>
  )
}
```

The StyleX application would be `stylex.props(styles.base, selected && styles.selected)`. Zyzz calls each definition first. `cx` preserves generated classes, variable bindings, and recipe attributes. Separate JSX spreads overwrite props rather than composing them.

Later conflicting declarations win under matching conditions at equal specificity and importance. Shorthands still reset their longhands in authored order. StyleX's default property-specificity resolution gives longhands priority over shorthands, so an existing composition involving both needs a computed-style check.

For example, a later Zyzz `padding: '8px'` resets an earlier `paddingLeft: '12px'`. Move the longhand later if that is the intended result. Preserve logical properties and check both LTR and RTL behavior when the original build performs direction-dependent transforms.

### Conditional Composition

Use `enabled && styles.example()` for conditional arguments. `false`, `null`, and `undefined` omit an entire argument. `cx` currently supports at most eight conditional arguments. Ternary selections, arbitrary arrays of styles, and escaping or mutated props bindings are outside its supported source contract.

Migrate finite style-map lookups into [Component Variants](#component-variants). See [`cx`](../api/core/cx.md) for supported local bindings and packed library applications.

### Component Boundaries

StyleX's [`StyleXStyles`](https://stylexjs.com/docs/api/types/StyleXStyles/) can describe a prop containing styles that a component merges internally. A component parameter is not a compiler-resolved Zyzz application, so replacing `stylex.props(base, props.style)` with `cx(base(), props.style)` is not supported.

Expose explicit recipe choices for component appearance and typed callback inputs for changing values. Use standard `className` and `style` props for external overrides:

```tsx
import type { ComponentPropsWithoutRef } from 'react'
import { style } from 'zyzz'

namespace styles {
  export const button = style({ padding: '8px' })
}

export function Button({
  className,
  style,
  ...props
}: ComponentPropsWithoutRef<'button'>) {
  return <button {...props} {...styles.button({ className, style })} />
}
```

This changes the component's styling contract. External classes follow the CSS cascade, and inline styles cannot express pseudo-classes or media queries. The callable accepts React's `style` prop and merges it with generated bindings. Keep events, children, and accessibility props on the element.

## States And Queries

### Pseudo-Classes

StyleX nests conditions inside each property:

```ts
import * as stylex from '@stylexjs/stylex'

const styles = stylex.create({
  button: {
    backgroundColor: { default: '#2563eb', ':hover': '#1d4ed8' },
    opacity: { default: 1, ':disabled': 0.5 },
  },
})
```

Zyzz groups declarations under each condition:

```ts
import { style } from 'zyzz'

namespace styles {
  export const button = style({
    backgroundColor: '#2563eb',
    opacity: 1,
    ':hover': { backgroundColor: '#1d4ed8' },
    ':disabled': { opacity: 0.5 },
  })
}
```

Move the StyleX `default` value into the base block. If it is `null`, omit that base declaration. Preserve any surrounding media conditions, such as `@media (hover: hover)`, rather than adding or removing them during translation.

### Media And Container Queries

Move property-level query branches into shared blocks. For example, StyleX's `padding: { default: 16, '@media (min-width: 48rem)': 24 }` becomes:

```ts
import { style } from 'zyzz'

namespace styles {
  export const card = style({
    padding: '16px',
    '@media (min-width: 48rem)': { padding: '24px' },
  })

  export const container = style({
    containerName: 'card',
    containerType: 'inline-size',
  })

  export const content = style({
    display: 'grid',
    gridTemplateColumns: '1fr',
    '@container card (min-width: 30rem)': {
      gridTemplateColumns: '1fr 1fr',
    },
  })
}
```

Apply `styles.container()` to an ancestor of the element using `styles.content()`. Preserve exact query thresholds and container names. Nested conditions combine with AND. When several conditions match the same property, retain the intended precedence and verify overlapping query ranges.

StyleX's [`defineConsts`](https://stylexjs.com/docs/api/javascript/defineConsts/) inlines shared constants. For migration, keep query strings literal or use configured Zyzz breakpoints. A CSS custom property cannot replace a media-query threshold. Theme tokens are a separate choice and can introduce CSS variables rather than inlining the original constant.

### Pseudo-Elements

Move a StyleX top-level `::placeholder` block under Zyzz's `selectors`:

```ts
import { style } from 'zyzz'

namespace styles {
  export const input = style({
    selectors: {
      '&::placeholder': { color: '#666' },
    },
  })
}
```

Retain `content` when migrating `::before` or `::after`. Every selector branch must contain `&`.

### Element Relationships

StyleX's [`when`](https://stylexjs.com/docs/api/javascript/when/) APIs use markers and relationship conditions. Zyzz can reference a previously declared identity-only style in a selector:

```tsx
import { style } from 'zyzz'

namespace styles {
  export const disclosure = style()

  export const label = style({
    opacity: 0.7,
    selectors: {
      [`${disclosure}[data-state="open"] &`]: { opacity: 1 },
    },
  })
}

export function Disclosure({ open }: { open: boolean }) {
  return (
    <div {...styles.disclosure()} data-state={open ? 'open' : 'closed'}>
      <span {...styles.label()}>Details</span>
    </div>
  )
}
```

Replace each marker's application as well as its dependent rules. Match the original ancestor, descendant, or sibling relationship and specificity. See [Style Relationships](conditions.md#style-relationships) for supported selectors.

## Component Variants

StyleX commonly selects entries from style maps and combines them with `props`. Zyzz's `variants` groups finite choices, defaults, and compound rules in one definition:

```tsx
import type { Props } from 'zyzz'
import { variants } from 'zyzz'

namespace styles {
  export const button = variants({
    base: { display: 'inline-flex' },
    compoundVariants: [
      { style: { fontWeight: 600 }, when: { size: 'large', tone: 'primary' } },
    ],
    defaultVariants: { size: 'small', tone: 'primary' },
    variants: {
      size: {
        large: { padding: '16px' },
        small: { padding: '8px' },
      },
      tone: {
        neutral: { backgroundColor: '#e5e7eb', color: '#111' },
        primary: { backgroundColor: '#2563eb', color: 'white' },
      },
    },
  })
}

type ButtonProps = Props.Variants<typeof styles.button>

export function SaveButton(props: ButtonProps) {
  return <button {...styles.button(props)}>Save</button>
}

const example = <SaveButton size="large" tone="neutral" />
```

Each recipe styles one element. Defaults apply to omitted selections, and `null` suppresses a choice. Preserve the order of conflicting choices and compounds from the original composition. `Props.Variants` infers styling inputs, not ordinary button events or children. See [Variants](variants.md).

## Dynamic Values

StyleX defines a dynamic style function as a namespace entry:

```tsx
import * as stylex from '@stylexjs/stylex'

const styles = stylex.create({
  bar: (width: string) => ({ width }),
})

export function Bar({ width }: { width: `${number}%` }) {
  return <div {...stylex.props(styles.bar(width))} />
}
```

Zyzz declares a typed input object and passes values to the generated callable:

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

Both examples bind a value to a precompiled CSS variable. Preserve units explicitly. Perform application calculations before calling the style, then pass the result as a typed scalar. Do not generate property names, selectors, or query structure from runtime inputs.

Zyzz callbacks support explicit scalar inputs and supported local type aliases. Imported or generic dynamic input types are outside the current extraction boundary. See [Dynamic Values](styling.md#dynamic-values) for source restrictions.

## Vars And Themes

### Design Tokens

StyleX defines shared variables in a `.stylex.ts` module:

```ts
// tokens.stylex.ts
import * as stylex from '@stylexjs/stylex'

export const colors = stylex.defineVars({
  accent: '#2563eb',
  surface: '#fff',
  text: '#111',
})

export const spacing = stylex.defineVars({ gap: '16px' })
```

For a Zyzz design system, group those values by token domain in a config:

```ts
// zyzz.config.ts
import { Config } from 'zyzz'

export const { style, vars, variants } = Config.create({
  vars: {
    color: { accent: '#2563eb', surface: '#fff', text: '#111' },
    spacing: { gap: '16px' },
  },
})
```

```tsx
import { style, vars } from './zyzz.config.js'

namespace styles {
  export const panel = style({
    backgroundColor: 'surface',
    color: vars.color.text,
    padding: 'gap',
  })
}

export function Panel() {
  return <section {...styles.panel()}>Content</section>
}
```

The configured helper resolves token names. Explicit `vars` references avoid collisions with CSS literals. Use `vars` for CSS expressions. Zyzz config modules are ordinary source modules and do not require a `.stylex.ts` suffix.

### Independent Vars

Not every StyleX variable belongs in a Zyzz theme group. Use [`variable`](../api/core/variable.md) for a custom property with its own scope and assignments:

```tsx
import { style, variable } from 'zyzz'

namespace variables {
  export const accent = variable('color')
}

namespace styles {
  export const scope = style({
    variables: { [variables.accent]: '#2563eb' },
  })

  export const label = style({ color: variables.accent })
}

export function Label() {
  return (
    <section {...styles.scope()}>
      <span {...styles.label()}>Account</span>
    </section>
  )
}
```

Unlike `defineVars` with defaults, `variable('color')` alone does not assign a value. The example applies its default on an ancestor. Inline assignments use the same `variables` option on a callable. Registration through `variable(kind, options)` is optional and changes inheritance or initial-value behavior.

Keep existing application-owned custom-property names when external CSS or scripts depend on them. Generated StyleX and Zyzz names are not interchangeable. Preserve the definition scope of derived variables, since moving an expression to a different ancestor can change inherited-variable resolution.

### Theme Overrides

StyleX's [`createTheme`](https://stylexjs.com/docs/learn/theming/creating-themes/) overrides a variable group for a subtree. A Zyzz catalog uses one shared token contract and extensions:

```ts
// zyzz.config.ts
import { Config, Vars } from 'zyzz'

const base = Vars.define({
  color: { accent: '#2563eb', surface: '#fff', text: '#111' },
  spacing: { gap: '16px' },
})

const mint = Vars.extend(base, { color: { accent: '#047857' } })

export const { style, varss } = Config.create({
  defaultVars: 'base',
  vars: {
    base,
    mint,
  },
})
```

```tsx
import { style, varss } from './zyzz.config.js'

namespace styles {
  export const label = style({ color: 'accent' })
}

export function Preview() {
  return (
    <section {...vars({ set: 'mint' })}>
      <span {...styles.label()}>Account</span>
    </section>
  )
}
```

An extension keeps the base contract and its unchanged values. Independently defined themes do not share variable identity merely because names match. If StyleX themes independently override several variable groups, preserve those scope boundaries with separate configs or independent variables rather than assuming one catalog reproduces every combination.

### Dark Mode

For StyleX variables driven by `prefers-color-scheme`, preserve the media query or use paired Zyzz color tokens with an explicit scheme:

```tsx
import { Config } from 'zyzz'

const { style } = Config.create({
  vars: {
    color: {
      surface: { dark: '#111', light: '#fff' },
      text: { dark: '#fff', light: '#111' },
    },
  },
})

namespace styles {
  export const panel = style({
    backgroundColor: 'surface',
    color: 'text',
    colorScheme: 'light dark',
  })
}

export function Panel() {
  return <section {...styles.panel()}>Content</section>
}
```

`light dark` follows system preference. Use `light` or `dark` to force a scheme. CSS `color-scheme` also affects browser-rendered controls, so compare that behavior. A manual theme toggle needs its existing state and persistence migrated explicitly. Media preference alone does not preserve it.

During coexistence, both libraries need to receive the intended theme selection. Applying a Zyzz scope does not update StyleX variables. See [Themes & Tokens](themes.md#dark-mode) for nested schemes, initialization scripts, and appearance controls.

## Stylesheets And Delivery

### Keyframes

Replace `stylex.keyframes` with the named `keyframes` import from `zyzz/web` and retain the frame values:

```ts
import { style } from 'zyzz'
import { keyframes } from 'zyzz/web'

const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })

namespace styles {
  export const notice = style({
    animationDuration: '200ms',
    animationName: fade,
    '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
  })
}
```

Preserve animation timing, fill mode, iteration count, and reduced-motion behavior. Keep font loading and global CSS, or migrate them explicitly with [`fontFace`](../api/web/fontFace.md) and [`global`](../api/web/global.md).

### Source And Packages

The build adapter discovers and links Zyzz definitions. Renaming a `.stylex.ts` file or importing a config does not convert StyleX authoring. Both compilers remain necessary while both APIs are present.

Shared source must fit the selected adapter's source boundaries. Precompiled Zyzz libraries publish matching JavaScript, declarations, CSS, and `.zyzz.json` compiler contracts. StyleX metadata cannot replace those contracts. Keep a StyleX dependency's required CSS until the dependency itself migrates. See [Publish Libraries](compilation.md#publish-libraries).

### CSS Output

Zyzz defaults to atomic output and supports grouped output through config. Similar output formats do not guarantee identical class names, merging rules, or bundle sizes. Treat classes as compiler output and compare rendered behavior. See [CSS Output](css-output.md).

Preserve any existing cascade-layer order while both stylesheets load. Test initial navigation, lazy routes, and server rendering with the production build. Server and client require matching compiled identities and CSS available before styled content paints.

## API Reference

| StyleX                             | Zyzz migration                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `create({ name: declarations })`   | [`style(declarations)`](#define-styles) inside a `namespace styles`              |
| `props(styles.name)`               | Call `styles.name()` and spread its result                                       |
| `props(a, b)`                      | [`cx(a(), b())`](#compose-styles) for supported generated applications           |
| Style maps and conditional choices | [`variants`](#component-variants) or supported conditional `cx` arguments        |
| Dynamic style functions            | [Typed `style` callbacks](#dynamic-values)                                       |
| Property-level condition objects   | [Condition blocks and `selectors`](#states-and-queries)                          |
| `defineVars`                       | [Configured theme tokens or independent variables](#variables-and-themes)        |
| `createTheme`                      | [Shared theme contracts and scopes](#theme-overrides)                            |
| `defineConsts`                     | Literal values, supported static bindings, or configured breakpoints             |
| `firstThatWorks`                   | [Fallback arrays in reverse order](#fallback-values)                             |
| `keyframes`                        | [`keyframes` from `zyzz/web`](#keyframes)                                        |
| `when.*` and markers               | [Selector relationships and identity-only styles](#element-relationships)        |
| `StyleXStyles` props               | [Explicit component inputs or standard styling overrides](#component-boundaries) |
| `null` property values             | [Omit or conditionally apply the declaration](#removing-declarations)            |

Other StyleX APIs and compiler extensions need an explicit mapping. For `attrs`, follow Zyzz's HTML output contract. For registered variables, preserve syntax, inheritance, and initial values. Do not assume StyleX-specific helpers or compiler options pass through to Zyzz unchanged.

## Finish Migrating

### Verify Appearance

Compare both versions with identical content, fonts, resets, viewport sizes, and writing directions. Check computed values rather than generated class strings. Include shorthand/longhand conflicts, fallback values, omitted declarations, and external overrides.

### Verify Interactions

Exercise keyboard focus, hover, disabled controls, application attributes, and element relationships. Test all recipe choices and representative dynamic values. Check overlapping query conditions, container boundaries, reduced motion, and touch input where applicable.

### Verify Themes

Check default and alternate themes, nested scopes, light/dark/system modes, persisted preferences, and the first paint. Retained StyleX components and migrated components must agree on the active selection.

### Production Builds

Run application type checks and the production build. Confirm stylesheet delivery for direct loads, lazy routes, and dependency components. For server rendering, inspect the page before hydration and after it. See [Testing & Migration](testing.md) and [Server Rendering](compilation.md#server-rendering).

### Remove StyleX

After all remaining consumers migrate, remove unused StyleX imports, packages, compiler integrations, lint rules, generated stylesheet entries, and marker props. Keep unrelated Babel, PostCSS, and CSS processing. Search application source and dependencies for remaining StyleX requirements, then rebuild and repeat the rendering checks.
