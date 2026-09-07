# Architecture and API

## Status and boundaries

This document specifies the target API. The prototype implements literal `css()` calls, a build integration, and a standalone library CLI. Custom themes, inferred theme functions, atomic output, and the expanded CLI below are planned.

The core owns typed ordered declarations, token resolution, validation, and deterministic identity. It has no filesystem, browser, device, parser, framework, or build-tool dependencies. Source adapters extract definitions; target emitters generate artifacts; host adapters deliver them.

Use small modules and subpath exports. All compilation paths share core semantics. Frameworks consume ordinary class strings or native style objects, without required providers, wrappers, or environment detection.

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

`Theme.define` uses exactly the supplied token groups, with no implicit preset merge. The default preset is separately available as plain `tokens` from `typestyle`; object spreads can opt into its groups. Token values must be statically resolvable and valid for their target.

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

`theme.css(style)` compiles to a class-name string containing one or more readable classes. Theme tokens autocomplete within their matching properties. Missing tokens and wrong domains fail type checking and compilation. CSS keywords remain supported; ambiguous literal values use the explicit escape described below.

Applications without a custom theme use the default preset directly:

```tsx
import { css } from 'typestyle'

const button = <button className={css({ padding: 4, color: 'blue.700' })} />
```

The custom and default functions share extraction and emission. Neither function generates styles in production. Untransformed authoring calls fail clearly; importing a function alone does not enable runtime compilation.

Token references such as `theme.tokens.backgroundColor.surface` preserve domain information for named, portable definitions. `Style.define(styles)` remains the in-memory API for named style data; target compilers produce distinct web and native outputs.

For standard CSS strings outside token unions, the MVP retains an explicit bracket escape, for example `color: '[oklch(60% 0.2 250)]'`. Its contents emit as CSS, subject to target validation. Do not widen every property to arbitrary `string`, which would hide misspelled tokens. A later typed literal helper requires demonstrated need.

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
import * as Web from 'typestyle/web'

const styles = Style.define({
  card: {
    backgroundColor: theme.tokens.backgroundColor.surface,
    padding: theme.tokens.spacing.md,
  },
})

const web = Web.compile({ styles, themes: { base: theme, alternate } })
web.css // Stylesheet string.
web.classes.card // Class-name string.
web.themes.alternate // Scope class-name string.
```

Theme map keys label outputs only; they do not define token identity or belong inside theme definitions. `Web.compile` returns `{ css, classes, themes }` and throws `Web.CompileError` with structured diagnostics. Direct in-memory calls need no parser or file access; source adapters additionally produce rewritten modules and source maps.

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

Native styles share token data and portable declarations. Web selectors and class strings are not native capabilities. Unit conversion is explicit, including `units.rem` when required; unavailable conversions and font mappings fail compilation. No runtime CSS parser, style merger, or compiler is introduced.

## CLI

The CLI is a first-class compilation path alongside build integrations and in-memory APIs. It owns filesystem and watch behavior, keeping the core environment-independent.

Existing prototype command:

```sh
typestyle src --out-dir dist
```

Proposed expanded commands:

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

Source adapters recognize literals, immutable bindings, spreads, imports, theme-bound calls, and destructured aliases without executing application code. Dynamic definitions, unresolved imports, and cycles fail with diagnostics. Generated exports contain constants and artifacts, not authoring closures.

The existing 29 tests cover the web baseline. Add type fixtures for per-property tokens, palette paths, complete pairs, bound-function aliases, and extension keys. Behavioral gates cover zero-setup themes, inherited overrides, CLI parity and recovery, native selection, deterministic readable names, collision handling, and cascade equivalence. See [the plan](plan.md).
