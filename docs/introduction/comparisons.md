# Comparisons

How Zyzz, Tailwind, StyleX, and vanilla-extract approach typed styling, themes, composition, and delivery. Examples use the same small components where practical. DX means developer experience; AX means agent experience.

> [!NOTE]
> Zyzz examples include unimplemented APIs. See [Compatibility](compatibility.md) for the current boundary and [Benchmarks](benchmarks.md) for a recorded run.

## Authoring, Types, and DX/AX

### Zyzz

`style` accepts standard CSS objects inline or outside a component and returns a callable that produces spreadable props. Property types, token domains, and variant choices provide compiler feedback. Readable generated classes help connect rendered output to authored styles. The root import has no built-in tokens.

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

Utilities keep styling in markup. Class strings are not TypeScript property contracts; the official editor extension supplies completion and diagnostics. Agents must emit complete, discoverable class names rather than construct fragments such as `bg-${color}-500`. See [editor support](https://tailwindcss.com/docs/editor-setup) and [source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files).

```tsx
export function Button() {
  return <button className="text-[#06c] p-[1rem]">Continue</button>
}
```

### StyleX

Typed objects are declared with `create` and consumed through `props` or `attrs`. Compilation constrains which expressions can appear in definitions. These constraints give agents a bounded authoring model; the project also publishes [LLM resources](https://stylexjs.com/docs/llm-resources). See [defining styles](https://stylexjs.com/docs/learn/styling-ui/defining-styles/) and [using styles](https://stylexjs.com/docs/learn/styling-ui/using-styles/).

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

Typed styles live in `.css.ts` modules and export class names. This introduces a file boundary between style definitions and components. Optional Sprinkles adds typed utility and token APIs. See [vanilla-extract](https://vanilla-extract.style/) and [Sprinkles](https://vanilla-extract.style/documentation/packages/sprinkles/).

```ts
// button.css.ts
import { style } from '@vanilla-extract/css'

export const button = style({ color: '#06c', padding: '1rem' })
```

```tsx
import { button } from './button.css.js'

export function Button() {
  return <button className={button}>Continue</button>
}
```

## Themes and Color Schemes

### Zyzz

`Theme.define` takes tokens and returns a bound `style`. Current colors accept the supported literal color grammar or light/dark pairs; token references emit CSS variables with defining fallbacks. `Theme.extend` shares the contract, and its `className` scopes inherited overrides. CSS `color-scheme` selects the active member of each `light-dark()` pair.

```ts
import { Theme } from 'zyzz'

const theme = Theme.define({
  color: { text: { light: '#111', dark: '#eee' } },
  spacing: { md: '1rem' },
})

namespace styles {
  export const panel = theme.style({
    color: 'text',
    padding: 'md',
    colorScheme: 'light dark',
  })
}
```

Property-specific groups such as `backgroundColor`, `textColor`, and `borderColor` constrain token use. The optional `zyzz/default` entrypoint is planned to export bundled `style`, `variants`, `theme`, and raw `tokens`; importing the core does not bring that theme along.

### Tailwind

The standard import includes a default theme. `@theme` customizes CSS variables and their corresponding utilities; defaults can also be removed. Color schemes can use `dark:` variants or native CSS values. See [theme variables](https://tailwindcss.com/docs/theme).

```css
@import 'tailwindcss';

@theme {
  --color-content: light-dark(#111, #eee);
}

:root {
  color-scheme: light dark;
}
```

```html
<section class="text-content p-[1rem]">Content</section>
```

### StyleX

Applications define variable contracts in `.stylex.ts` modules. Values can vary by media condition; `createTheme` supplies scoped overrides. This example follows the device preference, whereas a scoped theme can express an application-selected mode. See [variables](https://stylexjs.com/docs/learn/theming/defining-variables/) and [theme overrides](https://stylexjs.com/docs/api/javascript/createTheme/).

```ts
// tokens.stylex.ts
import * as stylex from '@stylexjs/stylex'

export const colors = stylex.defineVars({
  text: {
    default: '#111',
    '@media (prefers-color-scheme: dark)': '#eee',
  },
})
```

```ts
import * as stylex from '@stylexjs/stylex'
import { colors } from './tokens.stylex.js'

const styles = stylex.create({ panel: { color: colors.text } })
```

### vanilla-extract

`createTheme` returns a class and a typed variable contract. Additional themes reuse that contract. Apply the selected theme class to an ancestor; switching between these classes is explicit. See [creating themes](https://vanilla-extract.style/documentation/api/create-theme/).

```ts
// theme.style.ts
import { createTheme, style } from '@vanilla-extract/css'

export const [lightTheme, vars] = createTheme({
  color: { text: '#111' },
})
export const darkTheme = createTheme(vars, {
  color: { text: '#eee' },
})
export const panel = style({ color: vars.color.text })
```

## Selectors, Queries, and Value Helpers

### Zyzz

Selectors and conditions nest alongside declarations. Theme breakpoint and container thresholds infer query aliases and compile to literal conditions, not CSS variables. A container threshold alias addresses the nearest eligible ancestor; it does not name a container. Establish containment on that ancestor with `containerType: 'inline-size'`.

```ts
import { Theme } from 'zyzz'

const theme = Theme.define({
  spacing: { sm: '0.5rem', md: '1rem' },
  breakpoints: { tablet: '48rem' },
  containers: { card: '24rem' },
})

namespace styles {
  export const panel = theme.style({
    display: ['block', 'grid'],
    padding: 'sm',
    ':hover': { opacity: 0.8 },
    '&[data-loading="true"]': { cursor: 'wait' },
    '@media tablet': { padding: 'md' },
    '@container card': { gap: 'md' },
    width: `calc(100% - ${theme.vars.spacing.md})`,
  })
}
```

Arrays preserve fallback declaration order: later supported values win, subject to importance. The suffix ` !important` marks importance, as in `color: 'brand !important'`. Ordinary strings express CSS values; `theme.tokens` disambiguates token references. Raw media/container conditions and `@supports` remain available.

### Tailwind

Prefixes express pseudo states, data attributes, viewport breakpoints, and container queries. Theme namespaces provide breakpoint and container thresholds. Arbitrary values and variants cover custom expressions; a trailing `!` marks importance. See [utility styling](https://tailwindcss.com/docs/styling-with-utility-classes) and [theme namespaces](https://tailwindcss.com/docs/theme).

```html
<div class="@container">
  <section
    class="p-2 hover:opacity-80 data-[loading=true]:cursor-wait md:p-4 @sm:grid"
  >
    Content
  </section>
</div>
```

### StyleX

Conditions belong inside property values. Shared query strings can be exported with `defineConsts` and inlined during compilation. Selector support follows StyleX's constraints rather than unrestricted CSS selector strings. See [style definitions](https://stylexjs.com/docs/learn/styling-ui/defining-styles/) and [query constants](https://stylexjs.com/docs/api/javascript/defineConsts/).

```ts
import * as stylex from '@stylexjs/stylex'

const styles = stylex.create({
  panel: {
    opacity: { default: 1, ':hover': 0.8 },
    padding: {
      default: '0.5rem',
      '@media (width >= 48rem)': '1rem',
    },
  },
})
```

`stylex.firstThatWorks` lists the preferred value first, followed by alternatives. Its argument order differs from an authored sequence of fallback declarations.

### vanilla-extract

Style objects support pseudo states, selectors, media queries, and container queries. Sprinkles can expose named conditions. Arrays express fallback declarations in order. See [styling](https://vanilla-extract.style/documentation/styling/) and [Sprinkles conditions](https://vanilla-extract.style/documentation/packages/sprinkles/).

```ts
// panel.css.ts
import { style } from '@vanilla-extract/css'

export const panel = style({
  display: ['block', 'grid'],
  padding: '0.5rem',
  ':hover': { opacity: 0.8 },
  '@media': {
    '(width >= 48rem)': { padding: '1rem' },
  },
})
```

## Variants and Overrides

### Zyzz

`theme.variants(definition)` infers tokens, choices, defaults, and compound rules. The direct `variants` import is token-free. Its callable result supplies a class and data attributes, encouraging explicit state attributes. Standard `Parameters` extracts the consumer contract. Choices may also be typed callbacks, with values scoped to that choice.

```tsx
import { Theme } from 'zyzz'

const theme = Theme.define({ spacing: { sm: '0.5rem', md: '1rem' } })
namespace styles {
  export const button = theme.variants({
    base: { display: 'inline-flex' },
    variants: {
      size: {
        sm: { padding: 'sm' },
        md: { padding: 'md' },
        custom: (values: { padding: `${number}px` }) => ({
          padding: values.padding,
        }),
      },
    },
    defaultVariants: { size: 'md' },
  })
}

type ButtonProps = NonNullable<Parameters<typeof styles.button>[0]>

export function Button(props: ButtonProps) {
  return <button {...styles.button(props)}>Continue</button>
}
```

`cx(base(), override())` combines applied props objects, preserving variable assignments, and gives later generated declarations precedence in matching selector/condition contexts. Importance retains CSS semantics. External classes and overlapping, different conditions do not receive a blanket last-argument guarantee. Shorthand/longhand interactions must preserve unaffected declarations.

Select a dynamic choice with `button({ size: { custom: { padding: '12px' } } })`. The result includes `data-size="custom"` and CSS variable assignments. Compounds match the choice name; payload changes keep the CSS fixed.

### Tailwind

Application code can map typed choices to complete utility strings and encode state with data attributes. Defaults and compound choices belong to that application API or an additional library. Class-string order does not resolve conflicting utilities; stylesheet order does. See [utility styling](https://tailwindcss.com/docs/styling-with-utility-classes).

```tsx
const sizes = { sm: 'p-2', md: 'p-4' } as const

type ButtonProps = { size?: keyof typeof sizes }

export function Button({ size = 'md' }: ButtonProps) {
  return <button className={`inline-flex ${sizes[size]}`}>Continue</button>
}
```

### StyleX

Style maps and conditional `props` arguments express component variants. For the same property, later styles win; specific longhands take precedence over shorthands by default. This differs from a general last-declaration rule. See [variants](https://stylexjs.com/docs/learn/recipes/variants/) and [style resolution](https://stylexjs.com/docs/learn/thinking-in-stylex/).

```tsx
import * as stylex from '@stylexjs/stylex'

const sizes = stylex.create({
  sm: { padding: '0.5rem' },
  md: { padding: '1rem' },
})

type ButtonProps = { size?: keyof typeof sizes }

export function Button({ size = 'md' }: ButtonProps) {
  return <button {...stylex.props(sizes[size])}>Continue</button>
}
```

### vanilla-extract

Optional Recipes provides typed choices, defaults, compound variants, and `RecipeVariants`. Its callable result is a class string. `style([base, overrides])` provides build-time composition; concatenating exported classes retains the CSS cascade. See [Recipes](https://vanilla-extract.style/documentation/packages/recipes/) and [composition](https://vanilla-extract.style/documentation/style-composition/).

```ts
// button.css.ts
import { recipe, type RecipeVariants } from '@vanilla-extract/recipes'

export const button = recipe({
  base: { display: 'inline-flex' },
  variants: {
    size: { sm: { padding: '0.5rem' }, md: { padding: '1rem' } },
  },
  defaultVariants: { size: 'md' },
})

export type ButtonProps = RecipeVariants<typeof button>
// button({ size: 'sm' }) returns a class string.
```

## Runtime Values

### Zyzz

`style(values => styles)` receives a typed input record. Every definition is callable: static calls return class props, and dynamic calls add inline CSS variables. Calls accept `className` and `style` overrides; consumed values stay out of component props. Other props stay on the component.

```tsx
import { style } from 'zyzz'

namespace styles {
  export const bar = style((values: { width: `${number}%` }) => ({
    width: values.width,
  }))
}

export function Bar() {
  return <div {...styles.bar({ width: '50%', className: 'progress' })} />
}
```

`variable()` declares independent shared variables; the `variables` property accepts assignments in both definitions and applications. Theme references use `theme.vars` for CSS expressions and `theme.tokens` for portable references. Dynamic callbacks bind values without generating rules.

### Tailwind

Inline styles handle values known only at runtime. CSS variable assignments can also feed static utilities, without generating a utility for every value. See [dynamic values](https://tailwindcss.com/docs/styling-with-utility-classes#when-to-use-inline-styles).

```tsx
export function Bar({ amount }: { amount: number }) {
  return <div className="h-2 bg-blue-600" style={{ width: `${amount}%` }} />
}
```

### StyleX

Dynamic style functions bind arguments to CSS variables used by compiled rules. They do not generate a new stylesheet for each value. See [dynamic styles](https://stylexjs.com/docs/learn/styling-ui/defining-styles/#dynamic-styles).

```tsx
import * as stylex from '@stylexjs/stylex'

const styles = stylex.create({
  bar: (width: string) => ({ width }),
})

export function Bar({ amount }: { amount: number }) {
  return <div {...stylex.props(styles.bar(`${amount}%`))} />
}
```

### vanilla-extract

Declare a variable in a stylesheet module, then bind it with the optional dynamic package. `assignInlineVars` returns inline assignments; `setElementVars` updates an element directly. See [dynamic variables](https://vanilla-extract.style/documentation/packages/dynamic/).

```ts
// bar.css.ts
import { createVar, style } from '@vanilla-extract/css'

export const amount = createVar()
export const bar = style({ width: amount })
```

```tsx
import { assignInlineVars } from '@vanilla-extract/dynamic'
import { amount, bar } from './bar.css.js'

export function Bar() {
  return <div className={bar} style={assignInlineVars({ [amount]: '50%' })} />
}
```

## Compilation, Libraries, and Platforms

### Zyzz

A pure core separates definitions from environment adapters. Web compilation emits CSS and class references; the CLI transforms source modules and writes styles independently of a bundler. Optional integrations handle development updates and production builds through that shared pipeline.

```sh
zyzz src --out-dir dist --watch
zyzz src --out-dir dist --minify
```

`Css` from `zyzz/web` exposes globals, keyframes, fonts, and in-memory compilation. `StyleSheet` from `zyzz/react-native` compiles supported shared definitions and selects static theme/scheme values. Web correctness takes priority; native rejects unsupported CSS semantics. React and Vue consume ordinary platform class/style APIs.

### Tailwind

The standalone CLI produces CSS from discovered utilities; integrations also exist for build tools. Libraries can distribute compiled CSS or arrange consumer source scanning. The primary output is web CSS; native requires a separate integration. See [the CLI](https://tailwindcss.com/docs/installation/tailwind-cli) and [source registration](https://tailwindcss.com/docs/detecting-classes-in-source-files).

```sh
npx @tailwindcss/cli -i ./src/input.css -o ./dist/output.css --watch
```

### StyleX

The official CLI transforms source modules, emits CSS, and can insert CSS imports. This enables library precompilation without requiring consumers to compile original StyleX definitions. Build integrations provide other entrypoints. The output targets web CSS. See [the StyleX CLI](https://stylexjs.com/docs/learn/installation/cli/).

```sh
stylex --config .stylex.json5 --watch
```

### vanilla-extract

Build integrations evaluate `.css.ts` modules and extract web CSS. Libraries can publish compiled JavaScript and CSS. The Vite integration specifically recommends Rollup for libraries and does not support Vite library builds. See [the Vite integration](https://vanilla-extract.style/documentation/integrations/vite/).

## Performance and Bundle Size

### Zyzz

> [!NOTE]
> Source compilation supports `Config.create({ cssOutput: 'atomic' | 'grouped' })`, defaulting to atomic. Both modes retain the same authoring API and cascade contract. See [CSS Output](../guides/css-output.md).

Static applications can fold into props constants; surviving callables perform props merging. Ordered rules allow deduplication where declaration identity and cascade order remain intact. Classes use readable names with collision suffixes.

Dynamic selection, variable binding, and composition may retain small helpers or metadata; their cost belongs in the delivered bundle measurement.

### Tailwind

Reusable utilities are generated from detected source usage. Utility styling requires no styling JavaScript runtime, though application variant helpers may add JavaScript. Bundle accounting includes CSS and utility strings in markup or JavaScript. See [source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files).

### StyleX

Atomic rules share declarations across styles. Local creation and application can compile away; cross-module composition and dynamic use can retain mappings and runtime work. Generated identifiers are generally opaque. Count CSS, emitted class strings, metadata, and retained helpers. See [StyleX's compilation model](https://stylexjs.com/docs/learn/thinking-in-stylex/).

### vanilla-extract

Static styles produce scoped CSS with no runtime style generation. Optional Sprinkles produces atomic utilities; Recipes, Sprinkles, and dynamic bindings can retain selection or assignment helpers. Integrations support short, debug, or custom identifiers. See [Sprinkles](https://vanilla-extract.style/documentation/packages/sprinkles/) and [identifier configuration](https://vanilla-extract.style/documentation/integrations/vite/#identifiers).

### Measurement

No matched speed or byte-size results are published here. Atomic output alone does not establish a performance winner. Compare equivalent rendered behavior with real builds and browsers, including each approach's required delivery artifacts.

- **Build Performance.** Measure cold builds, warm builds, and incremental edits separately, with cache state recorded.
- **Browser Performance.** Measure style recalculation and runtime selection/binding under equivalent interactions.
- **Bundle Size.** Report CSS, JavaScript, and markup as raw, gzip, and Brotli bytes. Include helpers and metadata; avoid counting class strings twice. Report package download size separately.
- **Workloads.** Include repeated and mostly unique styles, small and large projects, themes, variants, and library boundaries.
- **Reproducibility.** Record versions, commits, hardware, warmup, sample counts, and variance. Validate behavior before timing; compare runs on the same machine.

Use the Vite Plus/Vitest benchmark runner for public compiler workflows, and real browser timing for rendering. Saved benchmark results and matched fixtures should accompany any future performance or size claims.
