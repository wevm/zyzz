# Comparisons

Zyzz, Tailwind CSS, StyleX, and vanilla-extract express the same styling tasks through different APIs. Each example group below specifies one behavior and uses the same elements, values, inputs, and states across all four libraries. Generated class names and implementation details can differ.

Examples use React and TypeScript with each library's build integration configured. Files named above a snippet belong to that example only. Tailwind examples target v4. To compare rendered output, use the same browser baseline and omit Tailwind's optional [Preflight reset](https://tailwindcss.com/docs/preflight#disabling-preflight).

## Authoring, Types, and DX/AX

All four examples render a button labeled "Continue" with `#06c` text and `1rem` padding. DX means developer experience. AX means agent experience.

### Zyzz

Definitions stay beside the component in `namespace styles`. Calling a definition returns styling props. Types constrain property names, supported values, tokens, and variant selections. Root imports contain no design tokens. See [Thinking in Zyzz](thinking-in-zyzz.md) and [style](../api/core/style.md).

```tsx
import { style } from 'zyzz'

namespace styles {
  export const button = style({ color: '#06c', padding: '1rem' })
}

export function Button() {
  return <button {...styles.button()}>Continue</button>
}
```

### Tailwind

Utilities keep declarations in markup. Class strings do not carry TypeScript property contracts. The official [editor extension](https://tailwindcss.com/docs/editor-setup) supplies completions and diagnostics. Both developers and agents must preserve [complete class names](https://tailwindcss.com/docs/detecting-classes-in-source-files), including inside conditional mappings.

```tsx
export function Button() {
  return <button className="text-[#06c] p-[1rem]">Continue</button>
}
```

### StyleX

Typed objects use `create`, and `props` applies them. Definitions must fit the compiler's [supported expressions](https://stylexjs.com/docs/learn/styling-ui/defining-styles/). StyleX also publishes [LLM resources](https://stylexjs.com/docs/llm-resources).

```tsx
import * as stylex from '@stylexjs/stylex'

const styles = stylex.create({
  button: { color: '#06c', padding: '1rem' },
})

export function Button() {
  return <button {...stylex.props(styles.button)}>Continue</button>
}
```

### vanilla-extract

Typed styles live in `.css.ts` modules and export class names. [Sprinkles](https://vanilla-extract.style/documentation/packages/sprinkles/) optionally adds typed utilities and token mappings. This example uses the core [style API](https://vanilla-extract.style/documentation/api/style/).

`button.css.ts`:

```ts
import { style } from '@vanilla-extract/css'

export const button = style({ color: '#06c', padding: '1rem' })
```

`Button.tsx`:

```tsx
import { button } from './button.css.js'

export function Button() {
  return <button className={button}>Continue</button>
}
```

## Themes and Color Schemes

Each panel has `1rem` padding and displays "Content". Text is `#111` in light mode and `#eee` in dark mode. All four examples use `light-dark()` with `color-scheme: light dark`, so selection follows the browser preference. None requires application state to select the scheme.

### Zyzz

`Config.create` binds tokens to named authoring helpers. Color pairs compile to `light-dark()`, and property domains constrain token usage. The optional [default theme](../api/default.md) is available from `zyzz/default`. See [Themes & Tokens](../guides/themes.md).

`zyzz.config.ts`:

```ts
import { Config } from 'zyzz'

export const { style, vars } = Config.create({
  vars: {
    color: { content: { dark: '#eee', light: '#111' } },
    spacing: { panel: '1rem' },
  },
})
```

`Panel.tsx`:

```tsx
import { style } from './zyzz.config.js'

namespace styles {
  export const panel = style({
    color: 'content',
    colorScheme: 'light dark',
    padding: 'panel',
  })
}

export function Panel() {
  return <section {...styles.panel()}>Content</section>
}
```

### Tailwind

`@theme` defines variables and their corresponding utilities. The standard import also includes default tokens. These imports retain the default theme and utilities while omitting Preflight. See [theme variables](https://tailwindcss.com/docs/theme).

`app.css`:

```css
@layer theme, base, components, utilities;
@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities);

@theme {
  --color-content: light-dark(#111, #eee);
  --spacing-panel: 1rem;
}
```

`Panel.tsx`:

```tsx
export function Panel() {
  return (
    <section className="text-content p-panel [color-scheme:light_dark]">
      Content
    </section>
  )
}
```

### StyleX

`defineVars` exports a variable contract from a `.stylex.ts` module. The consuming style references those variables. Enable the documented module-resolution option for [theming](https://stylexjs.com/docs/learn/theming/defining-variables/).

`tokens.stylex.ts`:

```ts
import * as stylex from '@stylexjs/stylex'

export const tokens = stylex.defineVars({
  content: 'light-dark(#111, #eee)',
  panel: '1rem',
})
```

`Panel.tsx`:

```tsx
import * as stylex from '@stylexjs/stylex'
import { tokens } from './tokens.stylex.js'

const styles = stylex.create({
  panel: {
    color: tokens.content,
    colorScheme: 'light dark',
    padding: tokens.panel,
  },
})

export function Panel() {
  return <section {...stylex.props(styles.panel)}>Content</section>
}
```

### vanilla-extract

`createTheme` returns a theme class and a variable contract. Applying the theme class supplies the variables consumed by the panel. See [createTheme](https://vanilla-extract.style/documentation/api/create-theme/).

`panel.css.ts`:

```ts
import { createTheme, style } from '@vanilla-extract/css'

export const [theme, tokens] = createTheme({
  color: { content: 'light-dark(#111, #eee)' },
  spacing: { panel: '1rem' },
})

export const panel = style({
  color: tokens.color.content,
  colorScheme: 'light dark',
  padding: tokens.spacing.panel,
})
```

`Panel.tsx`:

```tsx
import { panel, theme } from './panel.css.js'

export function Panel() {
  return <section className={`${theme} ${panel}`}>Content</section>
}
```

## Selectors, Queries, and Value Helpers

Each panel is a grid inside an inline-size container. Padding changes from `0.5rem` to `1rem` at a `48rem` viewport. Gap changes from `0` to `1rem` at a `24rem` container width. Hover sets opacity to `0.8` on devices that support hover.

### Zyzz

Conditions nest beside declarations. This example uses literal thresholds. Configured breakpoint and container aliases can name the same conditions. See [Conditions](../guides/conditions.md).

```tsx
import { style } from 'zyzz'

namespace styles {
  export const container = style({ containerType: 'inline-size' })

  export const panel = style({
    display: 'grid',
    gap: '0',
    opacity: 1,
    padding: '0.5rem',
    '@container (min-width: 24rem)': { gap: '1rem' },
    '@media (min-width: 48rem)': { padding: '1rem' },
    '@media (hover: hover)': { ':hover': { opacity: 0.8 } },
  })
}

export function Panel() {
  return (
    <div {...styles.container()}>
      <section {...styles.panel()}>
        <span>First</span>
        <span>Second</span>
      </section>
    </div>
  )
}
```

### Tailwind

Prefixes express conditions. Explicit thresholds avoid depending on a project's breakpoint overrides. Tailwind's `hover:` variant includes the hover-capability query. See [responsive design](https://tailwindcss.com/docs/responsive-design) and [states](https://tailwindcss.com/docs/hover-focus-and-other-states).

```tsx
export function Panel() {
  return (
    <div className="@container">
      <section className="grid gap-0 opacity-100 p-[0.5rem] min-[48rem]:p-[1rem] @min-[24rem]:gap-[1rem] hover:opacity-80">
        <span>First</span>
        <span>Second</span>
      </section>
    </div>
  )
}
```

### StyleX

Conditions belong inside property values. `default` supplies the value outside the condition. [Style definitions](https://stylexjs.com/docs/learn/styling-ui/defining-styles/#media-queries-and-other--rules) support nested conditions, including media and container queries.

```tsx
import * as stylex from '@stylexjs/stylex'

const styles = stylex.create({
  container: { containerType: 'inline-size' },
  panel: {
    display: 'grid',
    gap: { default: '0', '@container (min-width: 24rem)': '1rem' },
    opacity: {
      default: 1,
      '@media (hover: hover)': { default: 1, ':hover': 0.8 },
    },
    padding: { default: '0.5rem', '@media (min-width: 48rem)': '1rem' },
  },
})

export function Panel() {
  return (
    <div {...stylex.props(styles.container)}>
      <section {...stylex.props(styles.panel)}>
        <span>First</span>
        <span>Second</span>
      </section>
    </div>
  )
}
```

### vanilla-extract

Style objects group media and container conditions under their respective keys. See [conditional styles](https://vanilla-extract.style/documentation/styling/).

`panel.css.ts`:

```ts
import { style } from '@vanilla-extract/css'

export const container = style({ containerType: 'inline-size' })
export const panel = style({
  display: 'grid',
  gap: '0',
  opacity: 1,
  padding: '0.5rem',
  '@container': { '(min-width: 24rem)': { gap: '1rem' } },
  '@media': {
    '(min-width: 48rem)': { padding: '1rem' },
    '(hover: hover)': { ':hover': { opacity: 0.8 } },
  },
})
```

`Panel.tsx`:

```tsx
import { container, panel } from './panel.css.js'

export function Panel() {
  return (
    <div className={container}>
      <section className={panel}>
        <span>First</span>
        <span>Second</span>
      </section>
    </div>
  )
}
```

Fallback values are a separate concern. Zyzz and vanilla-extract accept declaration arrays in authored order. StyleX's `firstThatWorks` takes the preferred value first. Tailwind can express feature-dependent alternatives with `supports-*` variants. These forms should not be compared by argument order alone.

## Variants and Overrides

Every `Button` accepts the same optional `size` and `tone` choices. Defaults are `regular` and `neutral`. All buttons use `inline-flex`, `400` font weight, and either `0.5rem` or `1rem` padding. Text is `#111` or `#06c`. The `regular` + `accent` combination uses `600` font weight.

### Zyzz

`variants` owns choices, defaults, and compound rules. `Props.Variants` infers component props from the definition, including styling overrides. The examples compare the shared size and tone choices. See [variants](../api/core/variants.md).

```tsx
import { type Props, variants } from 'zyzz'

namespace styles {
  export const button = variants({
    base: { display: 'inline-flex', fontWeight: 400 },
    compoundVariants: [
      { when: { size: 'regular', tone: 'accent' }, style: { fontWeight: 600 } },
    ],
    defaultVariants: { size: 'regular', tone: 'neutral' },
    variants: {
      size: {
        compact: { padding: '0.5rem' },
        regular: { padding: '1rem' },
      },
      tone: { accent: { color: '#06c' }, neutral: { color: '#111' } },
    },
  })
}

type ButtonProps = Props.Variants<typeof styles.button>

export function Button(props: ButtonProps) {
  return <button {...styles.button(props)}>Continue</button>
}
```

### Tailwind

Maps preserve complete utility strings. Defaults and the compound condition are ordinary component logic. Each property selects one utility, so the result does not depend on class-string order. See [conditional styling](https://tailwindcss.com/docs/styling-with-utility-classes).

```tsx
const sizes = { compact: 'p-[0.5rem]', regular: 'p-[1rem]' } as const
const tones = { accent: 'text-[#06c]', neutral: 'text-[#111]' } as const

type ButtonProps = {
  size?: 'compact' | 'regular'
  tone?: 'accent' | 'neutral'
}

export function Button({ size = 'regular', tone = 'neutral' }: ButtonProps) {
  const weight =
    size === 'regular' && tone === 'accent' ? 'font-[600]' : 'font-[400]'
  return (
    <button className={`inline-flex ${sizes[size]} ${tones[tone]} ${weight}`}>
      Continue
    </button>
  )
}
```

### StyleX

Style maps and conditional `props` arguments implement the [variant pattern](https://stylexjs.com/docs/learn/recipes/variants/). Later arguments resolve conflicts for the same property.

```tsx
import * as stylex from '@stylexjs/stylex'

const styles = stylex.create({
  base: { display: 'inline-flex', fontWeight: 400 },
  emphasized: { fontWeight: 600 },
})
const sizes = stylex.create({
  compact: { padding: '0.5rem' },
  regular: { padding: '1rem' },
})
const tones = stylex.create({
  accent: { color: '#06c' },
  neutral: { color: '#111' },
})

type ButtonProps = {
  size?: 'compact' | 'regular'
  tone?: 'accent' | 'neutral'
}

export function Button({ size = 'regular', tone = 'neutral' }: ButtonProps) {
  return (
    <button
      {...stylex.props(
        styles.base,
        sizes[size],
        tones[tone],
        size === 'regular' && tone === 'accent' && styles.emphasized,
      )}
    >
      Continue
    </button>
  )
}
```

### vanilla-extract

The optional [Recipes package](https://vanilla-extract.style/documentation/packages/recipes/) owns typed choices, defaults, and compound rules. `RecipeVariants` can infer the recipe contract. Its callable returns a class string.

`button.css.ts`:

```ts
import { recipe } from '@vanilla-extract/recipes'

export const button = recipe({
  base: { display: 'inline-flex', fontWeight: 400 },
  compoundVariants: [
    {
      variants: { size: 'regular', tone: 'accent' },
      style: { fontWeight: 600 },
    },
  ],
  defaultVariants: { size: 'regular', tone: 'neutral' },
  variants: {
    size: {
      compact: { padding: '0.5rem' },
      regular: { padding: '1rem' },
    },
    tone: { accent: { color: '#06c' }, neutral: { color: '#111' } },
  },
})
```

`Button.tsx`:

```tsx
import { button } from './button.css.js'

type ButtonProps = {
  size?: 'compact' | 'regular'
  tone?: 'accent' | 'neutral'
}

export function Button({ size, tone }: ButtonProps) {
  return <button className={button({ size, tone })}>Continue</button>
}
```

## Composition

Each example combines a button's `1rem` padding with an independent focus ring. Keyboard focus produces a `2px solid #06c` outline with a `2px` offset. Size and tone choices belong in variants, as above.

### Zyzz

`cx` combines applied styling props, including variable bindings and recipe attributes. Multiple JSX spreads would replace overlapping props. See [cx](../api/core/cx.md) for supported inputs and conflict rules.

```tsx
import { cx, style } from 'zyzz'

namespace styles {
  export const button = style({ padding: '1rem' })
  export const focusRing = style({
    ':focus-visible': { outline: '2px solid #06c', outlineOffset: '2px' },
  })
}

export function Button() {
  return <button {...cx(styles.button(), styles.focusRing())}>Continue</button>
}
```

### Tailwind

Independent utilities can share one class string. Conflicting utilities still follow stylesheet order, rather than their order in the string. See [conflicting styles](https://tailwindcss.com/docs/styling-with-utility-classes#conflicting-styles).

```tsx
const focusRing =
  'focus-visible:[outline:2px_solid_#06c] focus-visible:outline-offset-[2px]'

export function Button() {
  return <button className={`p-[1rem] ${focusRing}`}>Continue</button>
}
```

### StyleX

`props` composes style objects. StyleX resolves property conflicts through its [style resolution rules](https://stylexjs.com/docs/learn/thinking-in-stylex/), including its treatment of shorthands and longhands.

```tsx
import * as stylex from '@stylexjs/stylex'

const styles = stylex.create({
  button: { padding: '1rem' },
  focusRing: {
    outline: { default: null, ':focus-visible': '2px solid #06c' },
    outlineOffset: { default: null, ':focus-visible': '2px' },
  },
})

export function Button() {
  return (
    <button {...stylex.props(styles.button, styles.focusRing)}>Continue</button>
  )
}
```

### vanilla-extract

`style` accepts an array of existing styles for [build-time composition](https://vanilla-extract.style/documentation/style-composition/). Concatenating unrelated classes at runtime retains normal cascade behavior.

`button.css.ts`:

```ts
import { style } from '@vanilla-extract/css'

const base = style({ padding: '1rem' })
const focusRing = style({
  ':focus-visible': { outline: '2px solid #06c', outlineOffset: '2px' },
})
export const button = style([base, focusRing])
```

`Button.tsx`:

```tsx
import { button } from './button.css.js'

export function Button() {
  return <button className={button}>Continue</button>
}
```

## Element Relationships

Each `Card` receives `open: boolean`, writes `data-state="open"` or `"closed"` on a section, and renders a "Details" span inside it. The span has opacity `1` when open and `0.5` when closed. The examples observe the ancestor attribute through CSS.

### Zyzz

An empty `style()` supplies the card's selector identity. The label references that definition inside `selectors`. See [selectors](../api/core/selectors.md).

```tsx
import { style } from 'zyzz'

namespace styles {
  export const card = style()
  export const label = style({
    opacity: 0.5,
    selectors: { [`${card}[data-state="open"] &`]: { opacity: 1 } },
  })
}

export function Card({ open }: { open: boolean }) {
  return (
    <section {...styles.card()} data-state={open ? 'open' : 'closed'}>
      <span {...styles.label()}>Details</span>
    </section>
  )
}
```

### Tailwind

A named group marks the ancestor, and a data variant selects its state. See [parent state](https://tailwindcss.com/docs/hover-focus-and-other-states#styling-based-on-parent-state).

```tsx
export function Card({ open }: { open: boolean }) {
  return (
    <section className="group/card" data-state={open ? 'open' : 'closed'}>
      <span className="opacity-50 group-data-[state=open]/card:opacity-100">
        Details
      </span>
    </section>
  )
}
```

### StyleX

A marker identifies the ancestor, and `when.ancestor` observes its attribute. These APIs support [element relationships](https://stylexjs.com/docs/api/javascript/when/) within StyleX's selector model.

```tsx
import * as stylex from '@stylexjs/stylex'

const styles = stylex.create({
  label: {
    opacity: {
      default: 0.5,
      [stylex.when.ancestor('[data-state="open"]')]: 1,
    },
  },
})

export function Card({ open }: { open: boolean }) {
  return (
    <section
      {...stylex.props(stylex.defaultMarker())}
      data-state={open ? 'open' : 'closed'}
    >
      <span {...stylex.props(styles.label)}>Details</span>
    </section>
  )
}
```

### vanilla-extract

An exported class can be interpolated into another style's selector. See [complex selectors](https://vanilla-extract.style/documentation/styling/#complex-selectors).

`card.css.ts`:

```ts
import { style } from '@vanilla-extract/css'

export const card = style({})
export const label = style({
  opacity: 0.5,
  selectors: { [`${card}[data-state="open"] &`]: { opacity: 1 } },
})
```

`Card.tsx`:

```tsx
import { card, label } from './card.css.js'

export function Card({ open }: { open: boolean }) {
  return (
    <section className={card} data-state={open ? 'open' : 'closed'}>
      <span className={label}>Details</span>
    </section>
  )
}
```

## Runtime Values

Each `Bar` accepts a `width` percentage string and renders a div with that width, `0.5rem` height, and a `#06c` background. The input and appearance are identical. All four approaches reuse static CSS while changing a per-instance value.

### Zyzz

A typed callback binds its input to a precompiled CSS variable. Runtime calls supply values without generating rules. See [Dynamic Values](../guides/styling.md#dynamic-values).

```tsx
import { style } from 'zyzz'

namespace styles {
  export const bar = style((values: { width: `${number}%` }) => ({
    backgroundColor: '#06c',
    height: '0.5rem',
    width: values.width,
  }))
}

export function Bar({ width }: { width: `${number}%` }) {
  return <div {...styles.bar({ width })} />
}
```

### Tailwind

Utilities define fixed declarations. An [inline style](https://tailwindcss.com/docs/styling-with-utility-classes#when-to-use-inline-styles) supplies the runtime width without constructing a dynamic utility name.

```tsx
export function Bar({ width }: { width: `${number}%` }) {
  return <div className="h-[0.5rem] bg-[#06c]" style={{ width }} />
}
```

### StyleX

A [dynamic style function](https://stylexjs.com/docs/learn/styling-ui/defining-styles/#dynamic-styles) binds its argument to a compiled variable.

```tsx
import * as stylex from '@stylexjs/stylex'

const styles = stylex.create({
  bar: (width: `${number}%`) => ({
    backgroundColor: '#06c',
    height: '0.5rem',
    width,
  }),
})

export function Bar({ width }: { width: `${number}%` }) {
  return <div {...stylex.props(styles.bar(width))} />
}
```

### vanilla-extract

`createVar` declares a variable. The optional [Dynamic package](https://vanilla-extract.style/documentation/packages/dynamic/) assigns its value through inline styles.

`bar.css.ts`:

```ts
import { createVar, style } from '@vanilla-extract/css'

export const widthVar = createVar()
export const bar = style({
  backgroundColor: '#06c',
  height: '0.5rem',
  width: widthVar,
})
```

`Bar.tsx`:

```tsx
import { assignInlineVars } from '@vanilla-extract/dynamic'
import { bar, widthVar } from './bar.css.js'

export function Bar({ width }: { width: `${number}%` }) {
  return <div className={bar} style={assignInlineVars({ [widthVar]: width })} />
}
```

## Additional Zyzz APIs

The paired examples cover common tasks. These documented APIs cover further requirements, without implying that another library lacks an equivalent.

| API                                                                               | Purpose                                                                                                         |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [Appearance](../guides/themes.md)                                                 | Select named theme scopes and color schemes, with initialization scripts for saved preferences.                 |
| [CSS output](../guides/css-output.md)                                             | Choose atomic or grouped output without changing authoring or composition semantics.                            |
| [Property mappings](../guides/themes.md#property-mappings)                        | Configure optional aliases and property-specific token scales.                                                  |
| [Stylesheets](../api/web/README.md)                                               | Declare globals, cascade layers, fonts, keyframes, and supported CSS at-rules.                                  |
| [Typography sets](../guides/themes.md#typography-sets)                            | Apply a named set of font properties, with explicit field overrides.                                            |
| [Typed variables](../api/core/variable.md)                                        | Declare independent variables, constrain assignments with `.set`, and optionally emit `@property` registration. |
| [Variant conditions and payloads](../api/core/variants.md#conditional-selections) | Select choices through media/supports conditions or bind typed payloads to a dynamic choice.                    |

## Compilation, Libraries, and Platforms

Build commands perform different jobs, so they are not interchangeable examples. The relevant comparison is which artifacts each library produces and what a consuming application must load.

| Library         | Build and delivery                                                                                                                                                                                                                                                                           | Platforms                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Zyzz            | The [CLI](../api/cli.md) uses `zyzz build` or `zyzz dev` to emit transformed modules, CSS, maps, and metadata. Bundler integrations deliver styles automatically. [Published libraries](../guides/compilation.md#publish-libraries) include matching code, CSS, declarations, and contracts. | Web CSS and [React Native](../guides/native.md) through separate adapters. Unsupported native semantics produce errors. |
| Tailwind        | The [CLI](https://tailwindcss.com/docs/installation/tailwind-cli) emits CSS from detected utilities. Libraries distribute CSS or arrange [consumer source scanning](https://tailwindcss.com/docs/detecting-classes-in-source-files).                                                         | Web CSS. Native use requires a separate integration.                                                                    |
| StyleX          | The [CLI](https://stylexjs.com/docs/learn/installation/cli/) transforms modules, emits CSS, and can add CSS imports. Precompiled libraries ship generated artifacts.                                                                                                                         | Web CSS.                                                                                                                |
| vanilla-extract | [Build integrations](https://vanilla-extract.style/documentation/integrations/vite/) evaluate `.css.ts` modules and extract CSS. Libraries publish compiled JavaScript and CSS.                                                                                                              | Web CSS.                                                                                                                |

Zyzz's `Css` namespace compiles style data in memory. Stylesheet helpers such as `global`, `fontFace`, and `keyframes` are direct exports from `zyzz/web`. Source optimization and native output use separate compiler and host entrypoints.

## Performance and Bundle Size

Equivalent examples do not establish a performance winner. Compare generated CSS, JavaScript, and markup together. Account for selection helpers, variable bindings, metadata, and delivery conventions. See [Benchmarks](benchmarks.md) for the measured workloads and their limits.

| Library         | Output considerations                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zyzz            | Atomic or grouped CSS. Static applications can fold into props. Dynamic selection and composition can retain helpers.                                                               |
| Tailwind        | Shared utilities and class strings. Styling needs no JavaScript runtime, but component variant logic still contributes code.                                                        |
| StyleX          | Shared atomic declarations. Cross-module and dynamic applications can retain mappings and runtime work. See [compilation](https://stylexjs.com/docs/learn/thinking-in-stylex/).     |
| vanilla-extract | Scoped CSS. Optional [Sprinkles](https://vanilla-extract.style/documentation/packages/sprinkles/) produces atomic utilities, while Recipes and dynamic bindings can retain helpers. |

Measure cold builds, warm builds, and incremental edits separately. For browser comparisons, test the same states and computed styles before recording timing. Report raw, gzip, and Brotli sizes with versions and workload details. Count class strings once, and report package download size separately from delivered application assets.
