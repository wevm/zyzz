# Architecture and API

## Status and boundaries

PR 1.1 implements the literal `Style.define` boundary, immutable ordered data, and structured diagnostics, with integration/type coverage and an authoring benchmark. The [literal subset](../docs/literal-styles.md) documents the implemented surface. CSS emission, component authoring functions, themes, variants, CLI, and native rendering below remain implementation targets. The MVP prioritizes web correctness and includes a working native subset.

The core owns typed ordered declarations, token resolution, validation, and deterministic identity. It has no filesystem, browser, device, parser, framework, or build-tool dependencies. Source adapters extract definitions; target emitters generate artifacts; host adapters deliver them.

Use small modules and subpath exports. All compilation paths share core semantics. Frameworks consume ordinary props objects containing web classes/bindings or native styles, without required providers, wrappers, or environment detection.

## Entry Points

`css` and `variants` from `zyzz` author standard CSS with an empty token contract. The root entrypoint neither imports nor re-exports bundled themes or their token data. Importing a theme does not alter the root function or register global state.

Bundled themes use independent `zyzz/themes/<name>` entrypoints. The MVP provides `zyzz/themes/default` with named exports:

| Export     | Contract                                                             |
| ---------- | -------------------------------------------------------------------- |
| `css`      | The bound `theme.css` function with the theme's inferred tokens      |
| `variants` | The bound `theme.variants` function with the same inferred tokens    |
| `theme`    | The full theme for variants, scopes, extension, and target compilers |
| `tokens`   | Raw token definitions for explicit composition with `Theme.define`   |

The default theme bundles colors, typography, spacing, radii, and related design scales. Light and dark are color schemes within the theme. Additional themes follow the same entrypoint contract; consuming one theme must not include another theme's data or CSS.

The exported `css` and `variants` alias `theme.css` and `theme.variants`, with identical inference, token identities, and output. `tokens` contains authored definitions; `theme.tokens` contains portable token references. Source adapters recognize these bindings through package exports and re-exports without executing theme modules.

Platform APIs are named namespace exports from dedicated entrypoints:

```ts
import { Css } from 'zyzz/web'
import { StyleSheet } from 'zyzz/react-native'
```

`Css` owns web stylesheet authoring and compilation. `StyleSheet` owns React Native compilation and precompiled theme/scheme selection. Both consume shared `Style.define` data through pure in-memory APIs. The root entrypoint remains independent of these target namespaces and their platform adapters.

## Theme definition

`Theme.define(tokens)` accepts only token definitions. No name, identifier, contract metadata, or scheme container is required.

```ts
import { Theme } from 'zyzz'

export const theme = Theme.define({
  color: {
    brand: '#0066cc',
    muted: { light: '#666666', dark: '#999999' },
  },
  backgroundColor: {
    surface: { light: '#ffffff', dark: '#111111' },
  },
  textColor: {
    primary: { light: '#171717', dark: '#ededed' },
  },
  borderColor: {
    subtle: { light: '#dddddd', dark: '#333333' },
  },
  spacing: { sm: '0.5rem', md: '1rem' },
  borderRadius: { md: '0.5rem' },
})
```

Each color leaf has the type `string | { light: string; dark: string }`. A string applies to both schemes. A pair requires both values; partial pairs and unknown scheme keys are errors. Nested palette keys are supported, for example `color.blue.500`, consumed as `'blue.500'`.

Token names infer from literal definitions. A scheme pair is a leaf, never a palette namespace. Ambiguous paths, including literal keys containing the path separator, are rejected.

| Token group       | Properties receiving its keys                                         |
| ----------------- | --------------------------------------------------------------------- |
| `color`           | All supported color-valued properties                                 |
| `backgroundColor` | `backgroundColor`                                                     |
| `textColor`       | CSS `color`                                                           |
| `borderColor`     | Border color shorthand and physical/logical border color properties   |
| `spacing`         | Supported spacing and sizing properties                               |
| `borderRadius`    | Border radius shorthand and corner properties                         |
| `typography`      | Optional typed typography presets expanded into ordinary declarations |

Property-specific color groups augment the shared `color` group and win when a key exists in both. A `textColor.primary` token is available to `color: 'primary'`, but not `backgroundColor: 'primary'`. `textColor` is a token category; authored styles keep the standard CSS property `color`.

`Theme.define` uses exactly the supplied token groups, with no implicit preset merge. Bundled definitions are available as `tokens` from `zyzz/themes/default`; object spreads can opt into its groups. Token values must be statically resolvable and valid for their target.

## Consuming Styles

Every `css` definition returns a callable. Calling it returns plain props to spread onto a component. Static styles use `button()`; dynamic styles use `button(values)`. There is no direct class-string or props-object overload for consuming an uncalled definition.

```tsx
import { css } from 'zyzz'

const button = css({ color: '#06c', padding: '1rem' })

export function Button() {
  return <button {...button({ className: 'checkout' })}>Continue</button>
}
```

Theme-bound and bundled functions follow the same contract, with inferred tokens:

```tsx
import { css } from 'zyzz/themes/default'

const button = css({ padding: 4, color: 'blue.700' })
const element = <button {...button()} />
```

`Theme.define` returns bound `css` and `variants`, portable `tokens`, web variable references through `vars`, and a scope `className`. Destructuring, aliases, and re-exports retain inference. Static and dynamic definitions may be inline, module-level, exported, or imported. Extraction recognizes the authoring binding independently of markup position.

```tsx
const { css, variants } = theme

export const button = css({
  backgroundColor: 'surface',
  color: 'primary',
  borderColor: 'subtle',
  padding: 'md',
  borderRadius: 'md',
  ':hover': { backgroundColor: 'brand' },
})

const element = <button {...button()}>Continue</button>
```

Inline usage is also valid: `<button {...css({ padding: '1rem' })()} />`. Extraction replaces definitions with small props-binding functions and can fold fully static applications into constants. No runtime style generation occurs. Untransformed authoring calls fail with an actionable missing-transform diagnostic.

Token names autocomplete in their matching properties. CSS literals and keywords remain available; explicit `theme.tokens` references select tokens whose names collide with CSS values. `Style.define` remains the pure in-memory API for named definitions; low-level `Css.compile` still returns stylesheet text and class maps independently of the component authoring interface.

## Value Syntax

Importance uses a trailing `!` on a string. Fallbacks use a nonempty array of values, in declaration order. CSS expressions are ordinary strings or template literals. There is no helper context or helper callback.

```ts
const panel = theme.css({
  display: ['block', 'grid'],
  color: 'brand!',
  backgroundColor: 'oklch(60% 0.2 250)',
  borderColor: theme.vars.color.brand,
  width: `calc(100% - ${theme.vars.spacing.md})`,
})
```

Parse a single final, unescaped `!` outside CSS strings, comments, and functions as declaration importance, before resolving a token or literal. Also accept standard trailing `!important`. Quoted content such as `content: '"Hello!"'` retains its punctuation. Reject malformed or repeated markers. An important numeric value uses a CSS string, for example `opacity: '0.5!'`; nonzero numeric spacing tokens retain their ordinary token rules.

Each fallback array entry is a separate declaration. Later supported entries win subject to ordinary CSS importance; `['block!', 'grid']` retains the important first declaration. Empty/nested arrays are errors. Comma-separated CSS lists remain strings, for example `fontFamily: 'Inter, sans-serif'`. Do not reorder or deduplicate away meaningful fallback sequences. Native rejects unsupported fallback/importance semantics rather than silently dropping them.

The compiler only interprets importance and fallback structure visible in source. Runtime strings cannot inject importance or new declarations. A statically authored suffix such as `${values.width}!` may mark a supported dynamic scalar binding important; passing `'50%!'` as a runtime value does not change rule priority. Dynamic fallback groups remain outside the initial supported subset.

`theme.tokens` supplies portable references with property domains. `theme.vars` supplies a readonly inferred tree of web CSS `var()` references for scalar declaration tokens, with the defining value as fallback. Template interpolation retains reference identity and liveness. Theme references can be imported or destructured without executing theme modules; root imports have no implicit theme or token data.

`theme.vars.spacing.md` follows inherited theme overrides. Color-pair values use `light-dark()` under the ordinary color-scheme contract. Query thresholds, container names, and composite typography presets are excluded from `theme.vars`; queries resolve to literal conditions. Native accepts portable `theme.tokens` and rejects web-only `theme.vars` references.

Root `css` accepts literal lengths, valid unitless numbers, and CSS zero. Named tokens and nonzero numeric spacing tokens require a theme. CSS literal/keyword precedence resolves ambiguous names; explicit token references select the token instead. Arbitrary CSS expressions use literal strings and receive compiler syntax validation; they do not implicitly interpolate token names.

TypeScript checks token/reference paths and direct property domains, including fallback entries and important suffixes. Full CSS grammar validation belongs to the compiler for static expressions and to the browser for arbitrary runtime strings.

Applied web props contain a readonly `className` and optional `style`, plus validated recipe data attributes when applicable. The `className` field may retain an optional `ClassName<Properties>` brand for restricted component contracts; this describes a field, never the return type of the definition itself. Metadata is not enumerable component output.

## Attributes and composition

Prefer platform state attributes and custom data attributes over conditional class concatenation:

```tsx
const button = theme.css({
  ':disabled': { opacity: 0.5 },
  '&[aria-expanded="true"]': { backgroundColor: 'brand' },
  '&[data-loading="true"]': { cursor: 'progress' },
})

<button {...button()} disabled={disabled}
  aria-expanded={expanded} data-loading={loading} />
```

Native/ARIA attributes must reflect actual behavior and accessibility semantics. Visual variants use data attributes. A data attribute alone does not disable a control or supply accessibility state.

`cx(base(), override())` is the explicit composition API, with later arguments winning for conflicting generated declarations in the same selector/condition context. It accepts generated props objects and conditional false/null/undefined entries and returns one spreadable props object. Combine classes with the generated conflict metadata, merge owned custom-property bindings, and preserve recipe data attributes. For repeated variable keys, later bindings win; conflicting recipe attribute ownership remains an error. An external class can be supplied explicitly as `{ className: external }`, without a last-wins guarantee for its CSS. Static compositions compile away; dynamic compositions use an optional resolver over compiler-produced metadata and precompiled rules, never a CSS generator.

Plain concatenation retains CSS cascade semantics. External `className` fields pass through `cx` without a last-wins guarantee. Do not pass bare class strings or uncalled style definitions to `cx`. Multiple JSX spreads perform ordinary property replacement and are not style composition; use `<button {...cx(base(), override())} />` to preserve both classes and bindings. Matching condition contexts compose; different overlapping conditions retain their declared CSS precedence. Importance still follows CSS semantics. Define shorthand/longhand partial overrides, fallback groups, logical/physical interactions, and conditional cancellation in fixtures before claiming reliable composition.

A props object containing a class string does not itself supply conflict metadata. Keep compiler metadata outside enumerable DOM props; never spread internal metadata onto components. The implementation gate must prove how imported generated classes carry or explicitly supply metadata to the transformed resolver across package boundaries, without a global registry. If required metadata is unavailable, emit a diagnostic rather than silently concatenate with a false guarantee. Static atom normalization must make partial overrides possible without generating new runtime rules.

## Dynamic Styles and Styling Overrides

An expression-bodied callback receives only the runtime values record. An annotated parameter defines the input contract; the callback returns an object with static property/selector/condition structure. `css` always returns a callable, regardless of whether its definition is an object or callback.

```tsx
import { css } from 'zyzz'

const track = css({ height: '0.5rem' })
const bar = css((values: { width: `${number}%` }) => ({
  width: values.width,
}))

export function Progress() {
  return (
    <div {...track()}>
      <div {...bar({ width: '50%', className: 'progress' })} />
    </div>
  )
}
```

Static applications accept optional styling overrides. Dynamic applications combine required runtime values with `className` and `style` overrides in one input. Consumed values never become component props. The callback sees only its declared values. Event handlers, children, refs, accessibility state, and other component props stay on the component.

```tsx
type PanelValues = { readonly width: `${number}px`; readonly opacity: number }

const panel = theme.css((values: PanelValues) => ({
  width: values.width,
  opacity: values.opacity,
  color: theme.vars.color.brand,
  padding: 'md',
  ':hover': { opacity: values.opacity },
}))

const element = (
  <section
    {...panel({
      width: '320px',
      opacity: 0.8,
      className: 'checkout',
      style: { marginTop: '1rem' },
    })}
  />
)
```

Web overrides accept only `className` and `style`; native overrides use the target's `style` shape. Variant data attributes derive from selection keys and cannot be supplied directly as overrides. Reject unknown input keys in consumer types and untyped calls. Never forward arbitrary props, merge handlers, or mutate input objects.

Reserve `className`, `class`, `style`, `key`, and `ref` from runtime-value and variant names. Values may otherwise overlap component attribute names, but their declared keys are consumed; the component receives such attributes separately. Resolve the complete finite value-key set from the annotated input contract, including unused fields; do not strip only fields observed in the callback. Reject index signatures, unresolved key sets, and ambiguous contracts before emission. Library declarations and precompiled binding metadata preserve that key set.

### Merge Rules

- **Classes.** Keep generated classes and append a supplied external `className`. External CSS follows the cascade; its position in the class string cannot guarantee an override. Generated-style last-wins composition uses `cx` and compiler metadata.
- **Inline Styles.** Merge generated variable assignments first and caller `style` second. Caller inline properties follow browser cascade semantics, including importance. Compiler-owned variable keys are private and cannot be assigned by caller overrides; use the declared runtime values instead. Preserve public custom properties such as explicit `Vars.set` bindings.
- **Variant Attributes.** Derive owned data attributes exclusively from validated selections. Change the selection key to override a choice. Keep unrelated attributes and all other component props outside the styling call.
- **Composition.** `cx(base(), dynamic(values), variants(selection))` returns styling props with the same class/style merge rules. Reject unrelated props. It preserves required variable bindings, rejects conflicting recipe attribute ownership, and never invokes or chains handlers. Repeated JSX spreads only replace fields and are not the style composition API.

For static definitions, `button()` can compile to constant props. A surviving imported callable needs only the props merge path. For dynamic definitions the compiler emits all CSS ahead of time and lowers value reads to fixed binding slots; the generated callable consumes input fields, assigns variables, and merges styling overrides. The original authoring callback never runs in the application. Values changing across calls retain the same classes and rule count.

The MVP supports required string/finite-number fields, direct record reads, and supported template interpolation into scalar declarations. No optional/null input leaves, runtime selectors/queries, dynamic object shape, computed reads, spreads, branches, or arbitrary calls inside definitions. Calculations happen at the call site or in supported CSS expressions. Runtime inputs are literal CSS values, never implicit token keys or numeric spacing tokens; use `variants` for finite token choices.

Source adapters resolve typed contracts and binding syntax before type erasure without executing application code. The pure core consumes ordered declarations and target-independent slots, shared with `Vars`. Untyped application calls validate required consumed fields and primitive shape; unknown keys are rejected as invalid styling inputs. Compiler diagnostics cover unsupported definitions and property domains.

React web output uses `className`/`style` props; Vue maps these at the class/style adapter boundary. Native output uses a native `style` prop, with caller overrides after generated styles and explicit unit conversion. Native does not parse CSS or emulate importance/fallbacks. `StyleSheet.select` remains static lookup. No provider, global registry, DOM mutation, or runtime stylesheet generation is introduced.

Integration gates cover static and dynamic calls, repeated updates, nested instances, pseudo/query values, theme inheritance, server/hydration parity, packed consumers, consumed-key removal, reserved-key errors, and styling override merging and unrelated-prop rejection. Verify private variables cannot inherit stale values, handlers stay on components, no metadata leaks into DOM props, and rule counts stay fixed. Consumer fixtures prove callable inference and strict override inputs. Benchmark static calls, dynamic binding, prop merging, emitted bytes, and browser recalculation separately.

## Typed runtime variables

```tsx
import { Vars, css } from 'zyzz'

const progress = Vars.define({ amount: 'percentage' })
const bar = css({ width: progress.amount })

<div {...bar({ style: Vars.set(progress, { amount: `${percent}%` }) })} />
```

Dynamic callbacks are the concise path for values local to one style. Keep `Vars` for explicit shared variable contracts and independent assignments. Both forms use the same compiler binding model.

`Vars.define(schema)` declares a set of typed variable references and compiles to target bindings. The initial schema supports `number`, `length`, `percentage`, and `color`, with target validation. `Vars.set(definition, values)` returns ordinary inline custom-property assignments on web; unknown keys or incompatible values are type errors. Unassigned variables follow normal CSS behavior unless the authored rule specifies a fallback.

Dynamic assignment is allowed; dynamic rule generation is not. The core never reads device/browser state. Native adapters bind values to preidentified supported properties with explicit conversions; they do not parse CSS. Unsupported variable types or expressions fail compilation. This binding path is distinct from `StyleSheet.select`, which preserves static lookup identity.

## Variants

`theme.variants(definition)` binds recipe definitions to the theme, just like `theme.css`. The direct `variants` export from `zyzz` has an empty token contract. Bundled theme entrypoints also export the bound function. No variant namespace or explicit theme argument is needed.

```tsx
const button = theme.variants({
  base: { display: 'inline-flex' },
  variants: {
    intent: {
      primary: { backgroundColor: 'brand' },
      ghost: { backgroundColor: 'transparent' },
    },
    size: {
      sm: { padding: 'sm' },
      md: { padding: 'md' },
    },
    loading: {
      true: { opacity: 0.5 },
      false: {},
    },
  },
  compoundVariants: [
    {
      when: { intent: 'primary', size: ['sm', 'md'] },
      style: { fontWeight: 600 },
    },
  ],
  defaultVariants: { intent: 'primary', size: 'md', loading: false },
})

type ButtonVariants = NonNullable<Parameters<typeof button>[0]>
const element = <button {...button({ intent: 'ghost', size: 'sm', loading })} />
```

`variants` and `theme.variants` take static recipe objects. Use `theme.tokens` and `theme.vars` for explicit references; no context callback is needed. Infer variant names, string values, booleans, defaults, compound keys, and style tokens. `NonNullable<Parameters<typeof button>[0]>` extracts selection props; callers can make selected properties required using ordinary type utilities. The selection argument is optional, so `button()` applies defaults. No custom props helper is required.

```ts
import { variants } from 'zyzz'

const button = variants({
  variants: { size: { sm: { padding: '0.5rem' }, md: { padding: '1rem' } } },
  defaultVariants: { size: 'md' },
})
```

Destructured `theme.variants`, imported aliases, and re-exports preserve inference and extraction. Recipe structure remains static; individual choices may be value callbacks as specified below. The selection input accepts only declared variant axes and styling overrides under the same merge rules as `css`. Reject reserved axis names and conflicting owned data attributes.

The web callable returns a stable recipe `className` and normalized attributes such as `data-intent="ghost"`, `data-size="sm"`, and `data-loading="true"`. Defaults are materialized in the output. Omitted/undefined selections use defaults; null suppresses that variant and its default, omitting its attribute. False serializes as `"false"`. Reject invalid values for declared selections from untyped callers; unknown input keys are errors.

Compile rules as `.button-k3m9:where([data-intent="ghost"])`, scoped to the recipe identity. Variant names must map unambiguously to valid data-attribute names; reject collisions after normalization. One recipe owns each emitted attribute on an element; combining recipes with conflicting attribute ownership needs explicit future composition support.

Precedence is base, then variant axes in declaration order, then matching compounds in array order, for otherwise matching contexts and importance. Compound arrays mean any listed value for that axis; different axes combine with AND. Compound rules apply styles and do not prohibit other combinations. Attribute selectors use zero added specificity so compilation controls recipe precedence.

Static calls compile to constants. Dynamic calls resolve selections/defaults, serialize attributes, bind active choice values, and merge styling overrides. No new classes or rules are generated. Avoid generating the Cartesian product of web variants: emit axis rules and authored compound rules. Keep optional `cx` overrides separate; recipe conditional rules must participate in the same documented conflict contract if composed.

The native target consumes the same recipe definition and selection types, emitting static alternatives with matching defaults and precedence. Its adapter returns platform styles without DOM attributes. Measure combination growth; deduplicate shared declarations and use precompiled ordered references where supported instead of generating CSS or unbounded tables. Browser-only selectors in a shared recipe produce target errors.

### Dynamic Variant Choices

Each choice accepts a static style object or a typed value callback. The callback follows the dynamic `css` contract and compiles to the same binding slots; runtime values remain local to that axis and choice.

```tsx
const button = theme.variants({
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
  compoundVariants: [{ when: { size: 'custom' }, style: { fontWeight: 600 } }],
})

const element = (
  <button
    {...button({ size: { custom: { padding: '12px' } }, className, style })}
    disabled={disabled}
    onClick={onClick}
  />
)
```

Static choices use their ordinary string/boolean selection. Dynamic choices require a single-key object, such as `{ custom: { padding: '12px' } }`. Its key selects the choice; its payload must exactly satisfy that callback's values contract. Reject bare dynamic names, empty/multiple-choice objects, unknown choices, missing/extra fields, wrong domains, and payloads attached to static choices. Input types preserve this discriminated union through `Parameters`, theme aliases, and packed declarations.

Defaults use the same selection shape. A dynamic default supplies a complete statically resolvable payload; a bare dynamic choice name is invalid. Omitted/undefined axes use the default; null suppresses the axis, its attribute, and its bindings. Boolean static choices keep their existing semantics. An object key for a dynamic boolean choice uses its normalized string name.

The output for the example includes the stable recipe class, `data-size="custom"`, and inline assignments for the selected choice's generated variables. Never serialize payloads into data attributes. Variables are scoped by recipe, axis, choice, and binding identity, so two choices may both name a field `padding` without sharing assignments. Switching choices emits a fresh complete assignment object containing only active bindings; real renderer tests must prove obsolete assignments are removed.

Compound conditions match normalized choice names, independently of payload values. `when: { size: 'custom' }` matches every valid custom padding; array matches retain their existing semantics. MVP base and compound style bodies remain static. Choice callback declarations may use supported pseudo/query conditions with fixed structure, just like dynamic `css`.

The scalar `padding` example expands to four longhand bindings sharing one value, preserving partial overrides through `cx`. Reject unsupported shorthand bindings rather than guess how to split runtime CSS. Keep importance and fallback restrictions identical to dynamic `css`.

Native binds active choice values to supported preidentified properties with explicit unit conversions and the same selection/default/compound behavior. Web-only semantics produce errors. Continuous payload values never create a Cartesian product or additional stylesheet rules.

Integration coverage must include real source compilation and rendering, active-to-static/null/default transitions, stale-variable cleanup, same-named payload fields on separate axes, compounds, theme/scheme changes, styling overrides, nested instances, and packed consumers. Consumer fixtures verify every rejected shape and inferred payload. Benchmark selection plus binding, emitted CSS/JavaScript, and native selection without rule or table growth per runtime value.

## Selectors and conditional rules

Style objects accept standard CSS properties, scoped selectors, and conditional at-rules. Nested declarations retain the same property types and theme-token inference at every depth.

```ts
const control = theme.css({
  display: 'inline-flex',
  color: 'primary',
  ':hover': { backgroundColor: 'brand' },
  ':focus-visible': { outlineStyle: 'solid' },
  ':disabled': { opacity: 0.5 },
  '&::before': { content: '"→"' },
  '& > svg': { width: '1em' },
  '&[aria-expanded="true"]': { backgroundColor: 'brand' },
  '@media (width >= 48rem)': {
    padding: 'md',
    ':hover': { color: 'brand' },
  },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  '@container (width >= 30rem)': { flexDirection: 'row' },
  '@supports (display: grid)': { display: 'grid' },
})
```

`&` refers to the current scoped selector. A leading pseudo-class or pseudo-element inserts `&`, so `:hover` means `&:hover`. Descendant, child, attribute, and compound selectors use explicit `&`. Nested selectors and conditions preserve their authored order, specificity, and conjunction; flattening must not change these semantics.

CSS property names and value types follow standard CSS, augmented by domain-specific tokens. Selector and raw condition strings remain flexible and receive compiler syntax validation; TypeScript does not prove that arbitrary selector/query text is valid. Do not add a general string index signature that hides misspelled properties.

The initial conditional syntax supports `@media`, `@container`, and `@supports`. Other at-rules require explicit capability support and diagnostics. Stylesheet-level rules use the optional `Css` APIs below, outside element declaration objects.

## Inferred query thresholds

Themes can define dedicated size thresholds separately from spacing and general sizing tokens:

```tsx
const { css } = Theme.define({
  spacing: { sm: '0.5rem', md: '1rem' },
  breakpoints: { tablet: '48rem', desktop: '64rem' },
  containers: { card: '24rem', panel: '40rem' },
})

export const layout = css({
  padding: 'sm',
  '@media tablet': {
    padding: 'md',
    ':hover': { opacity: 0.9 },
  },
  '@container card': { display: 'grid' },
})

const region = css({ containerType: 'inline-size' })
const example = (
  <section {...region()}>
    <div {...layout()} />
  </section>
)
```

| Theme group   | Inferred key      | Emitted rule                  |
| ------------- | ----------------- | ----------------------------- |
| `breakpoints` | `@media tablet`   | `@media (width >= 48rem)`     |
| `containers`  | `@container card` | `@container (width >= 24rem)` |

Alias keys autocomplete from the corresponding theme group and reject unknown names. `@media card` does not use `containers.card`, and `spacing.md` is not a query threshold. Nested conditions retain both alias inference and declaration inference. A theme without a threshold group offers no aliases for that group.

Threshold names are flat identifiers. Values are finite, nonnegative CSS lengths expressed as strings, such as `48rem` or `768px`; the compiler validates supported length units. Unitless numbers, percentages, runtime custom properties, and light/dark pairs are rejected. Keep standard unit semantics; do not convert relative thresholds to pixels implicitly.

Alias keys are exact shorthand forms. Raw media queries use explicit condition syntax, for example `@media (width >= 48rem)` or `@media screen and (width >= 48rem)`. Bare `all`, `screen`, and `print` remain reserved standard media types and cannot be breakpoint names. Reject unknown bare aliases instead of treating them as arbitrary query text.

`card` in `@container card` names a threshold, not a CSS container. The emitted unnamed query selects the nearest eligible ancestor for the queried feature. Applications establish size containment using standard `containerType`; a container cannot size-query itself. Named containers also support raw syntax such as `@container sidebar (width >= 24rem)` with an ancestor's `containerName: 'sidebar'`.

Thresholds resolve to literal conditions at compile time, never to CSS custom properties. Changing a theme scope or color scheme cannot alter existing query thresholds. `Theme.extend` may override existing thresholds for styles authored through the extended theme's `css`; it does not change queries already authored through the base function. Definition edits trigger dependent recompilation.

Rule identity and deduplication include resolved conditions. Different threshold values must not share an atom solely because their aliases have the same name. Do not sort breakpoints numerically or flatten overlapping conditions in ways that change authored precedence.

These are web capabilities. Native compilation rejects unsupported selectors and queries, including threshold aliases, until an explicit target contract exists. It must not silently turn browser queries into device listeners.

Additional inferred query keys support comparisons and ranges:

| Key                         | Meaning                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `@media >=tablet`           | Width at least tablet; equivalent to `@media tablet`        |
| `@media <desktop`           | Width below desktop                                         |
| `@media tablet..desktop`    | Inclusive tablet lower bound, exclusive desktop upper bound |
| `@container >=card`         | Nearest eligible container at least card width              |
| `@container sidebar >=card` | Named sidebar container at least card width                 |

`containerNames: ['sidebar', 'content']` in the theme infers names for both `containerName` declarations and named alias queries. Raw CSS names remain available through explicit literal/raw forms. Validate unknown names, malformed ranges, and reversed comparable bounds. Mixed-unit ranges retain CSS semantics; do not guess a pixel conversion or numerically sort them.

## Stylesheet APIs and layers

```ts
import { Css } from 'zyzz/web'

const fadeIn = Css.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
})
Css.global({
  'html, body': { margin: 0 },
  body: { fontFamily: 'system-ui' },
})
Css.fontFace({
  fontFamily: 'App Sans',
  src: 'url("/fonts/app.woff2") format("woff2")',
  fontWeight: '100 900',
  fontDisplay: 'swap',
})
const animated = theme.css({
  animationName: fadeIn,
  animationDuration: '200ms',
})
```

These authoring calls compile away into explicit stylesheet contributions. Preserve global/font-face side effects through tree shaking; emit reachable keyframes with stable references. Pure in-memory compilation receives extracted contributions as data and never relies on module registration. Native rejects these web-only operations; fonts are loaded through platform mechanisms.

```ts
Css.compile({
  styles,
  layers: {
    order: ['reset', 'base', 'components', 'utilities'],
    styles: 'components',
  },
})
```

Layer configuration is optional; omission preserves unlayered output. When supplied, emit the declared order and place generated element styles in the selected layer. Global rules belong to the base layer when declared, otherwise remain unlayered. Applications own the shared layer order across independently compiled libraries; conflicting declarations receive diagnostics when visible in one input graph. Normal and important declarations retain standard layer semantics.

The reset is opt-in via `import 'zyzz/reset.css'` and declares a reset layer. Merely importing the core changes no global styles. Test coexistence with ordinary stylesheets, global rules, and independently packaged libraries in multiple load orders. Layer ordering does not turn arbitrary class concatenation into last-wins composition.

## Theme scopes and extension

Theme-bound styles work without a root wrapper. Color and shared-token declarations reference generated custom properties with the defining theme's values as fallbacks. This permits ordinary inheritance and explicit overrides without automatically attaching a theme scope to every styled element.

```tsx
export const alternate = Theme.extend(theme, {
  color: { brand: '#147d32' },
  backgroundColor: {
    surface: { light: '#f0fff4', dark: '#081b0d' },
  },
})

const panel = (
  <section className={alternate.className}>
    <button {...theme.css({ backgroundColor: 'surface', color: 'brand' })()}>
      Continue
    </button>
  </section>
)
```

`Theme.extend(theme, overrides)` accepts partial token groups and existing keys only. Each overridden color is a complete string or scheme pair. It returns the same shape as `Theme.define` and inherits its token contract. Adding tokens uses a new definition; extension cannot silently change a component's contract.

`theme.className` and `alternate.className` compile to scope constants. Each scope emits the complete resolved set of live variables for that contract, preventing outer theme values leaking through omitted overrides. The original component classes work under either scope. Scope changes do not require recompiling components.

In-memory definitions carry opaque contract references. Source adapters derive stable internal identities from package identity, package-relative module location, and declaration binding; build hosts provide this context. Absolute machine paths, traversal order, and token values must not determine contract identity. Extensions reuse their base identity.

Independent definitions remain isolated even when their keys match. Library output preserves contract identity in generated artifacts. Renaming a definition can change identity; changing only its values cannot. Callers never supply this metadata to `Theme.define`.

## Light and dark

Scheme pairs emit `light-dark(lightValue, darkValue)`; plain strings emit unchanged. Normal CSS selects the scheme independently of the selected theme:

```css
:root {
  color-scheme: light dark;
}
.light {
  color-scheme: light;
}
.dark {
  color-scheme: dark;
}
```

`light dark` permits the browser's preferred scheme. `light` and `dark` select one explicitly. Theme scopes do not force a scheme. Nested scheme scopes retain theme values; nested theme scopes inherit the scheme. There is no preference listener or separate “system” token value.

Browser fixtures must cover fallback values, explicit variables, nested themes, forced schemes, preference changes, and server-rendered markup. Native targets resolve each pair into two static alternatives; strings are identical in both. Device preference resolution belongs in an application adapter.

## Pure target compilers

```ts
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

const styles = Style.define({
  card: {
    backgroundColor: theme.tokens.backgroundColor.surface,
    padding: theme.tokens.spacing.md,
  },
})

const web = Css.compile({ styles, themes: { base: theme, alternate } })
web.css // Stylesheet string.
web.classes.card // Class-name string.
web.themes.alternate // Scope class-name string.
```

Theme map keys label outputs only; they do not define token identity or belong inside theme definitions. `Css.compile` returns `{ css, classes, themes }` and throws `Css.CompileError` with structured diagnostics. Direct in-memory calls need no parser or file access; source adapters additionally produce rewritten modules and source maps.

```ts
import { StyleSheet } from 'zyzz/react-native'

const native = StyleSheet.compile({
  styles,
  themes: { base: theme, alternate },
  units: { rem: 16 },
})
const selected = StyleSheet.select(native.styles, {
  theme: 'alternate',
  colorScheme: 'dark',
})
selected.card // Precompiled native style object.
```

`StyleSheet.compile` returns `{ styles }` indexed by supplied theme label, scheme, and style name. It throws `StyleSheet.CompileError` for unsupported semantics. `StyleSheet.select` performs an identity-preserving lookup with inferred labels and `light | dark`; invalid untyped selections throw `StyleSheet.SelectionError`.

Native styles and variants share token data and portable declarations. Web selectors and class strings are not native capabilities. Unit conversion is explicit, including `units.rem` when required; unavailable conversions and font mappings fail compilation. No runtime CSS parser or compiler is introduced. Optional variable binding and recipe selection use explicit platform adapters; static theme lookup remains unchanged.

## CLI

The CLI is a first-class compilation path alongside build integrations and in-memory APIs. It owns filesystem and watch behavior, keeping the core environment-independent.

Planned default command:

```sh
zyzz src --out-dir dist
```

Planned watch and production commands:

```sh
# Compile authored modules and extract a stylesheet.
zyzz src --out-dir dist --css dist/styles.css

# Rebuild changed modules, styles, and imported theme dependencies.
zyzz src --out-dir dist --css dist/styles.css --watch

# Production output, retaining readable class names.
zyzz src --out-dir dist --css dist/styles.css --minify
```

`--out-dir` contains rewritten modules and declarations; `--css` defaults to `<out-dir>/styles.css`. Modules contain generated props-binding functions in place of definitions, with fully static applications eligible for constant folding. Both reference precompiled classes; authoring callbacks do not remain in delivered code. Applications import the stylesheet or load it through a standard stylesheet link. Libraries publish these artifacts directly.

CSS emission alone cannot make untouched `css()` calls executable. The standalone path must rewrite authoring modules; an application bundler can consume the rewritten tree without a styling plugin. A CSS-only mode is deferred until a concrete consumer can already provide matching compiled class references.

Watch mode handles additions, edits, deletions, renames, and imported theme changes, excluding output directories. Errors include source locations. One-shot errors exit nonzero; watch remains active and preserves the last complete successful output. Interrupts release watchers. Owned-output manifests prevent overwriting unrelated files.

The default target is web. A later `--target native` emits static tables through the same native emitter; CSS-specific flags are invalid for that target. CLI and build adapters must produce equivalent style identities and CSS for equivalent input graphs.

## Small CSS and readable classes

The initial optimization strategy is atomic emission for independent declarations, with shared rules deduplicated across the compilation graph. Preserve grouped rules where splitting would change declaration order or cascade behavior. Correctness is a release gate, not a tradeoff for fewer bytes.

Readable names contain a property or documented abbreviation, a token/value label, and any condition label. Illustrative names are `p-md-k3m9`, `bg-surface-a7c2`, and `hover-bg-brand-b4d8`. A short deterministic suffix distinguishes theme contracts, values, conditions, and ordering contexts; names never consist solely of a hash.

Use the same names in development and production. Minification compresses CSS syntax without renaming classes. Bound label length, escape valid identifiers, and check collisions with deterministic disambiguation. Do not embed source paths or require callers to write generated class strings.

Deduplication identity includes the full declaration value or variable fallback, theme contract, selector, at-rule stack, cascade layer, and any ordering constraints. Never merge identical-looking token labels from incompatible themes or change precedence through global sorting.

Conflicting shorthand/longhand declarations, overlapping logical/physical properties, and interacting conditional blocks require ordered groups unless a proven normalization preserves semantics. Combining independently compiled class strings follows stylesheet cascade order; class-string order is not an override API.

Emit only reachable rules and used token variables. Explicit theme scopes retain complete values for every live contract key. Independently compiled libraries remain correct without whole-application deduplication; cross-library deduplication is an optional consumer optimization.

Measure raw and compressed CSS, generated class-string bytes, total transferred bytes, rule count, compilation time, incremental updates, and representative browser style recalculation. Compare atomic and grouped output on repeated and mostly unique styles. Keep the smaller safe strategy without introducing a runtime or changing readable names.

## Extraction and acceptance

Source adapters recognize literals, immutable bindings, spreads, imports, theme-bound calls, and destructured aliases without executing application code. Dynamic definitions, unresolved imports, and cycles fail with diagnostics. Generated exports contain constants/artifacts and only the optional selection, binding, or composition operations actually used; no authoring closures or rule generation remain.

Build integration and consumer type coverage from scratch. No unit tests, mocks, stubs, fake timers, or replacement implementations. Exercise real public pipelines and their available stages, with real browser computed styles, filesystem/watch behavior, packed consumers, and native execution. Type fixtures import public entrypoints and run through TypeScript.

Cover per-property tokens, palette paths, complete pairs, bound aliases, extension keys, inferred queries, and invalid inputs. Integration gates cover theme inheritance, CLI recovery, native selection, deterministic names, collisions, and cascade equivalence. Include inline/exported/imported styles, containment, nested conditions, and immutable query thresholds under scope switching. See [the plan](plan.md).

Use Vite Plus/Vitest benchmarks over the same real consumer corpus, beginning with PR 1.1. Record baselines and candidate deltas for each implemented stage; browser rendering and host edit latency require real environment measurements. Keep artifact-size measurements separate from timing. Follow the reproducibility and regression rules in `AGENTS.md`.

## MVP gates

Web correctness leads the MVP; native is included, not deferred beyond it. Demonstrate shared layout, spacing, colors, typography, light/dark selection, and conditional variants on both mobile platforms. Publish explicit property/unit capabilities and fail unsupported web semantics.

Require actionable source diagnostics with valid alternatives, CSS-to-source tracing, refresh behavior, missing-transform errors, deterministic server output, and library stylesheet delivery. CLI and build adapters share options and useful defaults without a mandatory config file. Failed rebuilds preserve the previous complete output.

Compare grouped and atomic emission on repeated and unique styles. Measure compressed CSS, JavaScript, class strings, rule counts, cold/incremental builds, browser recalculation, native table growth, and optional runtime costs separately. Do not claim globally zero runtime when composition, variable assignment, or dynamic variants are used; all CSS rules remain compiled ahead of time.
