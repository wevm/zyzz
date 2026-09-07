# Implementation plan

## Goal

A minimal, type-safe styling system with an environment-independent core, shared web/native authoring, modular extensions, and optional integration adapters. Styles compile ahead of time. Core `css` has no tokens; bundled themes are opt-in through `typestyle/themes/default`. Color tokens accept shared values or light/dark pairs.

Web correctness leads the MVP, with a working native subset included before the MVP is complete.

## Principles

- **Agnostic:** core operates on plain data with no environment, framework, parser, or build-tool dependencies.
- **Universal:** shared style definitions work across rendering targets; target capabilities and output types are explicit.
- **Modular:** bundled themes, source extraction, core semantics, target emission, and host integration have narrow boundaries; root imports do not include theme data.
- **Minimal:** ordinary objects and small functions; no mandatory providers, component wrappers, global registries, or plugin framework.
- **Standards first:** prefer CSS properties, values, selectors, at-rules, custom properties, inheritance, and cascade behavior.
- **Compile time:** extract styles without executing application code; runtime logic only selects precompiled alternatives, binds typed values, serializes attributes, or resolves explicitly requested composition; it never generates rules.

## API contract

The proposed signatures, examples, type rules, and emitted theme CSS are specified in [API and architecture](architecture.md). They are implementation targets, not claims about the existing package.

| API                                  | Contract                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `css(style)` from `typestyle`        | Token-free web authoring with standard CSS values; emits classes and static CSS |
| `typestyle/themes/default`           | Exports bound `css`, full `theme`, and raw `tokens` for opt-in bundled styling  |
| `Style.define(styles)`               | Defines named, target-independent styles with typed token references            |
| `Theme.define(tokens)`               | Defines token groups; each color is a string or complete light/dark pair        |
| `Theme.extend(theme, overrides)`     | Creates a compatible theme with typed overrides and the same token contract     |
| `Css.compile(options)`               | Emits CSS, named classes, and theme scope classes from in-memory definitions    |
| `StyleSheet.compile(options)`        | Emits static style tables for each supplied theme and color scheme              |
| `StyleSheet.select(styles, options)` | Selects an existing theme/scheme table without compiling or merging             |
| `theme.css(style)`                   | Infers property-specific tokens and compiles directly to readable class strings |
| `theme.className`                    | Optional scope for inherited theme overrides                                    |
| `typestyle <src> --out-dir <dist>`   | Standalone module rewriting and stylesheet emission; planned watch/minify flags |

Additional agreed APIs are `css(callback)`, `cx(...)`, `Vars.define`/`Vars.set`, `Variant.define(theme, definition)`, `Variant.Props`, optional `ClassName<Properties>` contracts, and `Css.global`/`Css.keyframes`/`Css.fontFace`. Keep `css` as the authoring name; `Vars` defines a set of variables, while `Variant` is singular and receives the full theme first.

Import platform APIs as named namespaces: `Css` from `typestyle/web` and `StyleSheet` from `typestyle/react-native`. Shared style definitions remain under `Style` from `typestyle`; the root has no dependency on either target namespace.

Value context callbacks use a single `c` parameter. Helpers are accessed through `c`, portable token references through `c.tokens`, and inferred web CSS variable references through `c.vars`. Root `css` has empty token and variable trees; theme functions infer both from their theme.

## Starting point

Implementation starts from scratch. The repository contains the design, agent guidelines, and a zile-generated stub with Vite Plus tooling. The generated greeting and its test exercise scaffolding only. No styling implementation, examples, or styling compiler/CLI exist. All API contracts are targets to build and validate; no phase is complete.

Repository tooling is established: zile builds and links the library; Vite Plus runs oxfmt, oxlint, and tests. The generated source and test are placeholders; main and pull-request workflows verify tooling. These tools do not constrain the environment-independent core or mark a feature phase complete.

## Phase 1 — Build the core

Status: next.

- [ ] Define ordered style data, token references, validation, diagnostics, and deterministic identity independently of parsing and emission.
- [ ] Implement `Style.define` and the pure in-memory compilation boundary specified in the architecture.
- [ ] Keep environment-specific imports out of the core dependency graph; implement portable identities and collision handling.
- [ ] Build binding analysis, source rewriting, maps, file access, and watching in adapters.
- [ ] Keep root `css` token-free with standard CSS values and empty context token/variable trees. Keep all bundled theme imports and exports outside the root dependency graph.
- [ ] Implement the minimal literal `css()` path and establish its first behavioral and type fixtures.

Gate: identical core results across server, browser, worker, and native-engine fixtures. Core imports do not pull in bundled themes, parsers, frameworks, rendering targets, or file access. New core and literal-authoring behavioral/type fixtures pass.

## Phase 2 — Standard authoring and themes

Status: planned.

- [ ] Implement the `Theme.define` and `Theme.extend` contracts before widening authoring syntax.
- [ ] Add `typestyle/themes/default` with named `css`, `theme`, and raw `tokens` exports. Bundle colors, typography, spacing, radii, and related scales using the ordinary theme contract; keep light/dark values within the theme.
- [ ] Preserve inference and extraction for bundled `css` aliases and re-exports. Verify parity with `theme.css`, explicit token composition, and use of the exported theme with variants and target compilers.
- [ ] Accept token groups directly with no metadata or scheme container. Each color leaf is `string | { light: string; dark: string }`; require both fields for pairs.
- [ ] Infer `theme.css` arguments from shared `color` and property-specific `backgroundColor`, `textColor`, and `borderColor` groups, with documented fallback and override rules. Reject wrong domains, unknown tokens, partial pairs, and incompatible extensions.
- [ ] Derive internal theme identities without caller metadata; extensions retain base token identities independently of values. Switching theme scopes must not require recompiling component classes.
- [ ] Make bound styles work without a root scope using custom-property fallbacks; expose `theme.className` for inherited overrides and retain token-free `css` from the root entrypoint.
- [ ] Implement expression-bodied value context callbacks using `c.important`, `c.fallback`, `c.literal`, and inferred `c.tokens`, without arbitrary code execution.
- [ ] Accept ordinary strings and untagged template literals for CSS expressions. Fold static primitive interpolations and preserve recognized variable references; reject unknown object coercions, unresolved runtime values, and arbitrary function calls. Cover equivalent literal/template output, source diagnostics, variable liveness, and target validation.
- [ ] Expose inferred `c.vars` references for scalar declaration tokens on web. Emit CSS `var()` values with defining fallbacks and shared theme identities; preserve TypeScript domain checking in direct properties and compiler reference analysis within template expressions. Exclude query metadata and composite presets, and reject these references on native.
- [ ] Verify `c.vars` inference, unknown paths, incompatible domains, empty root contexts, bundled/custom themes, inherited overrides, light/dark fallbacks, variable liveness, and removal of callback contexts from generated modules.
- [ ] Define numeric token/literal behavior, keyword precedence, ordered fallbacks, expression references, and explicit literal escapes. Verify that root calls accept standard lengths, unitless values, and CSS zero while rejecting undeclared named/numeric tokens, even when a theme is imported elsewhere.
- [ ] Implement optional branded `ClassName<Properties>` types across exports, conditions, and shorthand expansion.
- [ ] Implement `Vars.define`/`Vars.set` with typed web bindings and explicit native support; separate runtime value assignment from style generation.
- [ ] Recognize imported and destructured theme functions with full inference and static extraction.
- [ ] Support static `css` calls inline, outside markup, and in exported/imported style constants equally; extraction must not depend on a `className` attribute.
- [ ] Implement scoped pseudo-classes/elements, explicit `&` selectors, and nested `@media`, `@container`, and `@supports` with theme inference at every depth.
- [ ] Add `breakpoints` and `containers` groups with inferred `@media <name>` and `@container <name>` aliases that expand into inclusive minimum-width conditions.
- [ ] Extend query inference with `>=`, `<`, inclusive/exclusive ranges, and `containerNames` for named queries and declarations.
- [ ] Reject unknown/cross-group aliases, reserved-name collisions, and invalid threshold lengths without weakening property checking or raw CSS condition support.
- [ ] Resolve query thresholds statically; specify extension overrides, dependent recompilation, and unchanged thresholds when switching runtime theme scopes.
- [ ] Document nearest eligible container selection, explicit containment, named raw queries, and stylesheet-level rule boundaries. Implement stylesheet contributions through `Css.global`, `Css.keyframes`, and `Css.fontFace`, with optional reset and layer configuration.
- [ ] Emit scoped custom properties and `light-dark()` values. Support `color-scheme: light`, `dark`, and `light dark`, independently of theme identity.
- [ ] Specify nested scope inheritance, complete overrides, independently forced schemes, deterministic server output, and undeclared-theme failures.
- [ ] Preserve standard declaration order, selectors, at-rules, inheritance, and cascade semantics. Specify literal escapes and retain authored condition order.
- [ ] Support same-module immutable definitions and spreads through static binding analysis; add imported definitions only with explicit resolution and cycle errors.

Gate: two compatible themes each work in both schemes. Switching a scope changes colors and shared tokens through CSS alone. Nested themes and explicit schemes behave as specified. Inline and exported styles retain inference. Nested selectors and raw/aliased queries preserve CSS semantics; invalid definitions fail without evaluating application code.

## Phase 3 — Composition, variants, and target output

Status: planned.

- [ ] Prefer native/ARIA state attributes and custom data attributes; retain `cx` for explicit last-wins composition within matching contexts.
- [ ] Prove static and dynamic composition metadata across package boundaries, partial shorthand overrides, conditions, fallback groups, and external-class limitations without runtime rule generation or global registration.
- [ ] Implement `Variant.define(theme, definition)` and `Variant.Props` with theme-first inference, base/variants/compounds/defaults, boolean selections, array compound matches, and value context callbacks.
- [ ] Compile web recipes to stable classes and scoped data-attribute selectors; dynamic calls serialize selections only. Validate attribute ownership, null/default behavior, and ordered precedence.
- [ ] Implement shared native recipe selection with the same inferred props and precedence; avoid unbounded variant/theme Cartesian products.
- [ ] Export `Css` as a named namespace from `typestyle/web`. Implement `Css.compile` as a pure emitter returning CSS, named classes, and theme scope classes. Theme maps name outputs without adding definition metadata.
- [ ] Emit deduplicated atoms with readable property/token/condition names and deterministic collision suffixes, retaining names in production.
- [ ] Preserve ordered groups for conflicting declarations and conditions; verify cascade equivalence before deduplication. Include resolved query thresholds in identity and retain authored condition order.
- [ ] Prune unreachable rules and unused variables while retaining complete live token sets in theme scopes.
- [ ] Export `StyleSheet` as a named namespace from `typestyle/react-native`. Implement `StyleSheet.compile` as a pure emitter returning complete static tables for every requested theme/scheme pair, with errors owned by the same namespace.
- [ ] Implement `StyleSheet.select` as a lookup only. System scheme, interaction, viewport, and accessibility inputs belong to application or host adapters.
- [ ] Prove the same named style definitions with shared tokens on web and native before expanding coverage.
- [ ] Specify native unit conversion and font handling; require explicit configuration where no portable default exists.
- [ ] Document target support for selectors, queries, custom properties, CSS functions, text inheritance, units, and state. Unsupported semantics must fail rather than disappear silently.
- [ ] Keep scheme-specific output and runtime selection outside the core; do not emulate a browser CSS engine on native.

Gate: shared definitions render on web and both mobile platforms. Theme/scheme selection agrees with the documented conversions. No runtime style generation is needed, and target-aware types reject unsupported declarations.

## Phase 4 — Integrations and distribution

Status: planned.

- [ ] Verify plain document, component, template, and native consumers through their normal class/style APIs.
- [ ] Build the CLI with `--css`, `--watch`, and `--minify`; rewrite modules alongside CSS and declarations, requiring no styling plugin in consumers.
- [ ] Verify CLI/build/in-memory parity, dependency watching, output exclusion, diagnostics, failure preservation, and owned-output cleanup. Include imported style constants and threshold edits in dependency recovery fixtures.
- [ ] Keep build integrations optional and thin; implement only those needed by concrete fixtures.
- [ ] Support framework source boundaries in source adapters without leaking template syntax into core semantics.
- [ ] Compile from in-memory definitions and from source adapters using the same target emitters.
- [ ] Distribute web modules, declarations, and CSS; distribute native modules, declarations, and static theme tables. Consumers do not need compiler integrations.
- [ ] Verify server rendering, hydration identity, state-preserving refresh where supported, CSS-to-source tracing, actionable missing-transform diagnostics, and add/edit/remove/rename recovery.
- [ ] Verify optional reset, global/font contributions, layer ordering, and independently packaged CSS in different loading orders.
- [ ] Test independent packed consumers for root, `themes/default`, and named `Css`/`StyleSheet` exports from `web`/`react-native`. Include bundled aliases through CLI/build extraction. Ensure root imports exclude bundled token data and CSS, and unused themes, targets, parsers, and tools stay out of runtime dependencies.

Gate: all integration paths use the same contracts and agree on identity. Theme classes and tables survive packaging. Static web styles compile away; optional runtime composition, value binding, and variant selection have measured isolated costs. No target generates rules at runtime.

## Phase 5 — Simplify and measure

Status: planned.

- [ ] Review every API and dependency against the principles; remove abstractions that duplicate platform behavior.
- [ ] Measure compilation, incremental updates, type-check cost, raw/compressed CSS, class-string bytes, total transfer, browser style recalculation, and native adapter cost independently.
- [ ] Measure theme multiplication and generated-table size; deduplicate without changing observable theme or cascade semantics.
- [ ] Compare atomic and grouped output on repeated and unique styles; optimize the smaller safe representation. Measure the agreed variant API; defer additional recipe abstractions and slot systems until concrete usage justifies them.
- [ ] Verify package metadata and the standard changeset/release workflow.

Gate: a small documented API, tested compatibility matrix, reproducible measurements, and working independent web/native consumers.

## Acceptance matrix

| Area           | Required proof                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| Core           | In-memory operation without environment, framework, parser, or build-tool dependencies                        |
| Types          | Named styles and token domains infer precisely; invalid schemes and overrides fail                            |
| Themes         | Colors accept shared strings or light/dark pairs; extensions share inferred token identities                  |
| Entry points   | Root `css` is token-free; opt-in theme exports preserve inference and identity without implicit theme imports |
| Web scopes     | Custom-property inheritance, nested themes, and explicit/system schemes work without a theme runtime          |
| Native schemes | Every theme/scheme pair is precompiled; selection is a deterministic lookup                                   |
| Standards      | CSS values, selectors, at-rules, declaration order, and cascade retain their semantics                        |
| Integration    | Document, component, template, native, server, and library consumers share the same contracts                 |
| Minimalism     | No required providers, wrappers, global setup, platform detection, or runtime compilation                     |
| CLI            | Standalone compilation rewrites calls, emits CSS, and matches other adapters; watch recovers from errors      |
| CSS output     | Readable stable names, collision safety, small measured artifacts, and unchanged cascade behavior             |
| Authoring      | Inline, module-level, and exported/imported styles share inference and compilation                            |
| Queries        | Correct alias completion, raw query support, static thresholds, containment, nesting, and precedence          |
| Variants       | Inferred theme-first definitions, attribute output, defaults, compounds, and native parity                    |
| Composition    | Documented last-wins resolution with metadata, partial overrides, and no rule generation                      |
| Variables      | Typed runtime assignments and explicit native binding capabilities                                            |

## Scope

The API and phases above are proposed. Implementation begins at Phase 1 with no retained code baseline. Build each capability and its acceptance fixtures before marking its phase complete.
