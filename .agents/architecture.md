# Architecture and API

## Status and boundaries

This document specifies the target API for a new implementation. The generated zile greeting stub provides the source entrypoint, with Vite Plus for formatting, linting, and tests. Only the scaffold greeting test exists; no styling implementation, compiler, CLI, or examples are present. All examples describe planned APIs. The MVP prioritizes web correctness and includes a working native subset.

The core owns typed ordered declarations, token resolution, validation, and deterministic identity. It has no filesystem, browser, device, parser, framework, or build-tool dependencies. Source adapters extract definitions; target emitters generate artifacts; host adapters deliver them.

Use small modules and subpath exports. All compilation paths share core semantics. Frameworks consume ordinary class strings or native style objects, without required providers, wrappers, or environment detection.

## Entry Points

`css` from `typestyle` authors standard CSS with an empty token contract. The root entrypoint neither imports nor re-exports bundled themes or their token data. Importing a theme does not alter the root function or register global state.

Bundled themes use independent `typestyle/themes/<name>` entrypoints. The MVP provides `typestyle/themes/default` with named exports:

| Export   | Contract                                                             |
| -------- | -------------------------------------------------------------------- |
| `css`    | The bound `theme.css` function with the theme's inferred tokens      |
| `theme`  | The full theme for variants, scopes, extension, and target compilers |
| `tokens` | Raw token definitions for explicit composition with `Theme.define`   |

The default theme bundles colors, typography, spacing, radii, and related design scales. Light and dark are color schemes within the theme. Additional themes follow the same entrypoint contract; consuming one theme must not include another theme's data or CSS.

The exported `css` is an alias of `theme.css`, with identical inference, token identities, and output. `tokens` contains authored definitions; `theme.tokens` contains portable token references. Source adapters recognize these bindings through package exports and re-exports without executing theme modules.

## Theme definition

`Theme.define(tokens)` accepts only token definitions. No name, identifier, contract metadata, or scheme container is required.

```ts
import { Theme } from 'typestyle'

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

`Theme.define` uses exactly the supplied token groups, with no implicit preset merge. Bundled definitions are available as `tokens` from `typestyle/themes/default`; object spreads can opt into its groups. Token values must be statically resolvable and valid for their target.

## Consuming styles

The returned theme exposes a bound `css` authoring function, typed token references, and an optional web scope class. Destructuring and imported aliases retain inference and are recognized by extraction.

```tsx
const { css } = theme

const button = (
  <button
    className={css({
      backgroundColor: 'surface',
      color: 'primary',
      borderColor: 'subtle',
      padding: 'md',
      borderRadius: 'md',
      ':hover': { backgroundColor: 'brand' },
    })}
  >
    Continue
  </button>
)
```

Styles can also be defined outside markup, exported, and imported into another module:

```tsx
const { css } = theme

export const buttonClass = css({
  backgroundColor: 'surface',
  color: 'primary',
})

function Button() {
  return <button className={buttonClass}>Continue</button>
}
```

Inline calls, module-level constants, and exported styles use the same inference and compilation rules. Extraction recognizes the authoring binding wherever a static call occurs; it does not depend on a `className` attribute. Imported compiled styles are ordinary strings. Root and bundled-theme `css` imports support the same forms.

`theme.css(style)` compiles to a class-name string containing one or more readable classes. Theme tokens autocomplete within their matching properties. Missing tokens and wrong domains fail type checking and compilation. CSS keywords remain supported; ambiguous literal values use the explicit escape described below.

Applications can author CSS without a theme:

```tsx
import { css } from 'typestyle'

const button = <button className={css({ padding: '1rem', color: '#06c' })} />
```

Applications opt into bundled tokens through the theme entrypoint:

```tsx
import { css } from 'typestyle/themes/default'

const button = <button className={css({ padding: 4, color: 'blue.700' })} />
```

Root, custom-theme, and bundled-theme functions share extraction and emission. None generates styles in production. Untransformed authoring calls fail clearly; importing a function alone does not enable runtime compilation.

Token references such as `theme.tokens.backgroundColor.surface` preserve domain information for named, portable definitions. `Style.define(styles)` remains the in-memory API for named style data; target compilers produce distinct web and native outputs.

## Value Context

Both `css` and `theme.css` accept a style object or an expression-bodied callback. A single context parameter, `c`, supplies value helpers and inferred theme references:

```ts
const panel = theme.css((c) => ({
  color: c.important('brand'),
  display: c.fallback('block', 'grid'),
  backgroundColor: c.literal('oklch(60% 0.2 250)'),
  borderColor: c.vars.color.brand,
  width: c.value`calc(100% - ${c.vars.spacing.md})`,
}))
```

The callback is recognized static syntax. The compiler resolves supplied helpers, constants, and token references without executing arbitrary application functions. Helpers need no separate imports. Literal and expression validation is target-specific; untyped callers also receive compiler diagnostics.

`c.tokens` exposes portable token references. On web, `c.vars` exposes a readonly, inferred tree of CSS variable references for scalar declaration tokens. Both trees are empty for `css` from `typestyle`; custom and bundled theme functions infer them from their theme. Value helpers remain available without a theme.

`c.vars.spacing.md` emits a CSS `var()` reference with the defining value as fallback. These string-compatible references retain token domains for property checking and work directly in declarations or within `c.value` templates. They reuse the theme contract's variable identities.

Variable references follow inherited theme overrides and color schemes. Color-pair fallbacks use `light-dark()` under the same color-scheme contract as ordinary theme declarations. Referenced variables count as live for emission and pruning. Access is resolved statically; no context object or theme lookup remains at runtime.

Query thresholds, container names, and composite typography presets are excluded from `c.vars`; query aliases still resolve to literal conditions. Unknown paths and incompatible property domains fail type checking and compilation. Native contexts retain portable `c.tokens` and reject web-only `c.vars` references.

| Form                                 | Meaning                                                            |
| ------------------------------------ | ------------------------------------------------------------------ |
| Nonzero numeric spacing/sizing value | Matching numeric theme token; missing tokens are errors            |
| Zero on a length property            | Standard CSS zero; use an explicit reference for a token named `0` |
| Number on a unitless property        | Literal number, such as `opacity: 0.5`                             |
| CSS length string                    | Literal length, such as `padding: '4px'`                           |
| Token name                           | Inferred token for that property                                   |
| CSS keyword                          | Standard keyword, taking precedence over an ambiguous token name   |
| Explicit token reference             | Resolves token/keyword collisions                                  |
| `c.tokens.<group>.<token>`           | Portable reference retaining the token's domain                    |
| `c.vars.<group>.<token>`             | Web CSS variable reference with an inferred token domain           |
| `c.literal(text)`                    | Explicit static CSS escape                                         |
| `c.value` tagged template            | Static CSS expression with typed token/variable references         |
| `c.fallback(...values)`              | Ordered declarations; later supported values win                   |
| `c.important(value)`                 | Important declaration on web                                       |

These helpers define the literal and fallback authoring contract. Preserve fallback order, including through composition and atomic optimization. Define numeric behavior per property; never infer a token-to-pixel fallback. Tokens inside shorthand expressions must be validated for their position where practical; arbitrary literal expressions are an explicit escape from token checking.

Root `css` accepts literal lengths, CSS keywords, unitless property numbers, and zero where CSS permits it. Token names such as `'blue.700'` and numeric spacing values such as `padding: 4` require a theme defining those tokens. Importing a bundled theme elsewhere does not make them valid in root calls.

Compiled style values remain assignable to strings but carry optional property information:

```ts
import type { ClassName } from 'typestyle'

type ButtonProps = {
  className?: ClassName<'color' | 'backgroundColor'>
}
```

A plain `string` prop remains unrestricted. `ClassName` contracts account for nested conditions, shorthand expansion, and composed declarations. Arbitrary external strings cannot satisfy a restricted branded contract without an explicit escape. Type fixtures must cover exports, unions, and composition; property information is not runtime data by itself.

## Attributes and composition

Prefer platform state attributes and custom data attributes over conditional class concatenation:

```tsx
const button = theme.css({
  ':disabled': { opacity: 0.5 },
  '&[aria-expanded="true"]': { backgroundColor: 'brand' },
  '&[data-loading="true"]': { cursor: 'progress' },
})

<button className={button} disabled={disabled}
  aria-expanded={expanded} data-loading={loading} />
```

Native/ARIA attributes must reflect actual behavior and accessibility semantics. Visual variants use data attributes. A data attribute alone does not disable a control or supply accessibility state.

`cx(base, override)` is the explicit composition API, with later arguments winning for conflicting generated declarations in the same selector/condition context. It accepts class references and conditional false/null/undefined entries. Static compositions compile away; dynamic compositions use an optional resolver over compiler-produced metadata and precompiled rules, never a CSS generator.

Plain concatenation retains CSS cascade semantics. External class strings pass through `cx` without a last-wins guarantee. Matching condition contexts compose; different overlapping conditions retain their declared CSS precedence. Importance still follows CSS semantics. Define shorthand/longhand partial overrides, fallback groups, logical/physical interactions, and conditional cancellation in fixtures before claiming reliable composition.

String output does not itself supply conflict metadata. The implementation gate must prove how imported generated classes carry or explicitly supply metadata to the transformed resolver across package boundaries, without a global registry. If required metadata is unavailable, emit a diagnostic rather than silently concatenate with a false guarantee. Static atom normalization must make partial overrides possible without generating new runtime rules.

## Typed runtime variables

```tsx
import { Var, css } from 'typestyle'

const progress = Var.define({ amount: 'percentage' })
const bar = css({ width: progress.amount })

<div className={bar}
  style={Var.set(progress, { amount: `${percent}%` })} />
```

`Var.define(schema)` declares typed references and compiles to target bindings. The initial schema supports `number`, `length`, `percentage`, and `color`, with target validation. `Var.set(definition, values)` returns ordinary inline custom-property assignments on web; unknown keys or incompatible values are type errors. Unassigned variables follow normal CSS behavior unless the authored rule specifies a fallback.

Dynamic assignment is allowed; dynamic rule generation is not. The core never reads device/browser state. Native adapters bind values to preidentified supported properties with explicit conversions; they do not parse CSS. Unsupported variable types or expressions fail compilation. This binding path is distinct from `Native.select`, which preserves static lookup identity.

## Variants

The namespace is singular `Variant`. The first argument is the full theme object, including `css`; the second is the recipe definition. Keep the authoring function named `css`.

```tsx
import { Variant } from 'typestyle'

const button = Variant.define(theme, {
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

type ButtonVariants = Variant.Props<typeof button>
const element = <button {...button({ intent: 'ghost', size: 'sm', loading })} />
```

`Variant.define` also accepts a value context callback as its second argument, with the same `c` context as `theme.css`. Infer variant names, string values, booleans, defaults, compound keys, and style tokens. `Variant.Props` exposes optional selection props; callers can make selected properties required using ordinary type utilities.

The web callable returns a stable recipe `className` and normalized attributes such as `data-intent="ghost"`, `data-size="sm"`, and `data-loading="true"`. Defaults are materialized in the output. Omitted/undefined selections use defaults; null suppresses that variant and its default, omitting its attribute. False serializes as `"false"`. Reject unknown selections from untyped callers.

Compile rules as `.button-k3m9:where([data-intent="ghost"])`, scoped to the recipe identity. Variant names must map unambiguously to valid data-attribute names; reject collisions after normalization. One recipe owns each emitted attribute on an element; combining recipes with conflicting attribute ownership needs explicit future composition support.

Precedence is base, then variant axes in declaration order, then matching compounds in array order, for otherwise matching contexts and importance. Compound arrays mean any listed value for that axis; different axes combine with AND. Compound rules apply styles and do not prohibit other combinations. Attribute selectors use zero added specificity so compilation controls recipe precedence.

Static calls compile to constants. Dynamic calls only resolve selections/defaults and serialize attributes, not concatenate variant classes. Avoid generating the Cartesian product of web variants: emit axis rules and authored compound rules. Keep optional `cx` overrides separate; recipe conditional rules must participate in the same documented conflict contract if composed.

The native target consumes the same recipe definition and selection types, emitting static alternatives with matching defaults and precedence. Its adapter returns platform styles without DOM attributes. Measure combination growth; deduplicate shared declarations and use precompiled ordered references where supported instead of generating CSS or unbounded tables. Browser-only selectors in a shared recipe produce target errors.

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
  <section className={region}>
    <div className={layout} />
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
import * as Css from 'typestyle/css'

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

The reset is opt-in via `import 'typestyle/reset.css'` and declares a reset layer. Merely importing the core changes no global styles. Test coexistence with ordinary stylesheets, global rules, and independently packaged libraries in multiple load orders. Layer ordering does not turn arbitrary class concatenation into last-wins composition.

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
    <button
      className={theme.css({ backgroundColor: 'surface', color: 'brand' })}
    >
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
import { Style } from 'typestyle'
import * as Css from 'typestyle/css'

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
import * as Native from 'typestyle/native'

const native = Native.compile({
  styles,
  themes: { base: theme, alternate },
  units: { rem: 16 },
})
const selected = Native.select(native.styles, {
  theme: 'alternate',
  colorScheme: 'dark',
})
selected.card // Precompiled native style object.
```

`Native.compile` returns `{ styles }` indexed by supplied theme label, scheme, and style name. It throws `Native.CompileError` for unsupported semantics. `Native.select` performs an identity-preserving lookup with inferred labels and `light | dark`; invalid untyped selections throw `Native.SelectionError`.

Native styles and variants share token data and portable declarations. Web selectors and class strings are not native capabilities. Unit conversion is explicit, including `units.rem` when required; unavailable conversions and font mappings fail compilation. No runtime CSS parser or compiler is introduced. Optional variable binding and recipe selection use explicit platform adapters; static theme lookup remains unchanged.

## CLI

The CLI is a first-class compilation path alongside build integrations and in-memory APIs. It owns filesystem and watch behavior, keeping the core environment-independent.

Planned default command:

```sh
typestyle src --out-dir dist
```

Planned watch and production commands:

```sh
# Compile authored modules and extract a stylesheet.
typestyle src --out-dir dist --css dist/styles.css

# Rebuild changed modules, styles, and imported theme dependencies.
typestyle src --out-dir dist --css dist/styles.css --watch

# Production output, retaining readable class names.
typestyle src --out-dir dist --css dist/styles.css --minify
```

`--out-dir` contains rewritten modules and declarations; `--css` defaults to `<out-dir>/styles.css`. Modules contain static class strings in place of authoring calls. Applications import the stylesheet or load it through a standard stylesheet link. Libraries publish these artifacts directly.

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

Build behavioral and type coverage from scratch. Add type fixtures for per-property tokens, palette paths, complete pairs, bound-function aliases, extension keys, and inferred query aliases. Reject unknown/cross-group thresholds and invalid length values. Verify inference inside nested selectors and queries. Behavioral gates cover zero-setup themes, inherited overrides, CLI parity and recovery, native selection, deterministic readable names, collision handling, and cascade equivalence. Cover inline/exported/imported style parity, pseudo-elements, named/unnamed containment, nested media/supports rules, threshold recompilation, and immutable thresholds under scope switching. See [the plan](plan.md).

## MVP gates

Web correctness leads the MVP; native is included, not deferred beyond it. Demonstrate shared layout, spacing, colors, typography, light/dark selection, and conditional variants on both mobile platforms. Publish explicit property/unit capabilities and fail unsupported web semantics.

Require actionable source diagnostics with valid alternatives, CSS-to-source tracing, refresh behavior, missing-transform errors, deterministic server output, and library stylesheet delivery. CLI and build adapters share options and useful defaults without a mandatory config file. Failed rebuilds preserve the previous complete output.

Compare grouped and atomic emission on repeated and unique styles. Measure compressed CSS, JavaScript, class strings, rule counts, cold/incremental builds, browser recalculation, native table growth, and optional runtime costs separately. Do not claim globally zero runtime when composition, variable assignment, or dynamic variants are used; all CSS rules remain compiled ahead of time.
