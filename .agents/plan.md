# Implementation plan

## Goal

A minimal, type-safe styling system with an environment-independent core, shared web/native authoring, modular extensions, and optional integration adapters. Styles compile ahead of time. Core `css` and `variants` have no tokens; bundled themes are opt-in through `zyzz/themes/default`. Color tokens accept shared values or light/dark pairs.

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

| API                                                   | Contract                                                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `css(style)` from `zyzz`                              | Token-free web authoring with standard CSS values; emits spreadable props and static CSS      |
| `zyzz/themes/default`                                 | Exports bound `css` and `variants`, full `theme`, and raw `tokens` for opt-in bundled styling |
| `Style.define(styles)`                                | Defines named, target-independent styles with typed token references                          |
| `Theme.define(tokens)`                                | Defines token groups; each color is a string or complete light/dark pair                      |
| `Theme.extend(theme, overrides)`                      | Creates a compatible theme with typed overrides and the same token contract                   |
| `Css.compile(options)`                                | Emits CSS, named classes, and theme scope classes from in-memory definitions                  |
| `StyleSheet.compile(options)`                         | Emits static style tables for each supplied theme and color scheme                            |
| `StyleSheet.select(styles, options)`                  | Selects an existing theme/scheme table without compiling or merging                           |
| `theme.css(style)`                                    | Infers property-specific tokens and compiles directly to props containing readable classes    |
| `css((values: Values) => style)`                      | Compiles static rules and returns a typed callable web class/style binding                    |
| `variants(definition)` / `theme.variants(definition)` | Defines token-free or theme-bound recipes with inferred selection props                       |
| `theme.className`                                     | Optional scope for inherited theme overrides                                                  |
| `zyzz <src> --out-dir <dist>`                         | Standalone module rewriting and stylesheet emission; planned watch/minify flags               |

Additional agreed APIs are callable static `css(style)`, `cx(...)`, `Vars.define`/`Vars.set`, optional `ClassName<Properties>` contracts, and `Css.global`/`Css.keyframes`/`Css.fontFace`. Export `css` and `variants` directly and bind both on themes. Extract recipe props with `NonNullable<Parameters<typeof button>[0]>`; no variant namespace or props helper is needed.

Import platform APIs as named namespaces: `Css` from `zyzz/web` and `StyleSheet` from `zyzz/react-native`. Shared style definitions remain under `Style` from `zyzz`; the root has no dependency on either target namespace.

Every `css` definition is callable. Static calls accept optional styling overrides; dynamic callbacks receive a typed values record, and applications combine those values and `className`/`style` overrides in one input. Calls return spreadable props. Consumed keys are stripped; classes and inline styles follow the architecture merge rules. Use trailing `!` and fallback arrays, with `theme.tokens` and `theme.vars` for explicit references. Other component props remain on the component. There is no context parameter.

## Starting point

PR 1.1 is merged and implements `Style.define`, integration/type scenarios, and external compiler benchmarks. PR 1.2 adds literal CSS emission and Zyzz compiler comparisons. Source rewriting, component APIs, themes, variants, and native output remain unimplemented.

Zile builds and links the library; Vite Plus runs oxfmt, oxlint, and integration tests. Existing CI checks consumer type fixtures, runs integration scenarios and builds the package. Tooling remains outside the core dependency graph.

## Phase 1 — Build the core

Status: in progress. [PR 1.1](https://github.com/wevm/zyzz/pull/1) is merged; [PR 1.2](https://github.com/wevm/zyzz/pull/3) is implemented and awaiting CI/review; PRs 1.3–1.5 are unstarted. Testing and benchmark conventions are defined in `AGENTS.md`.

Merge in dependency order. Each PR includes real integration scenarios, consumer type fixtures, relevant benchmark evidence, and public TSDoc. No unit tests, mocks, or stubs. Keep CI green and record the actual PR link and completion evidence beside each item as work lands.

| PR  | Scope                         | Depends on | Deliverable                                             |
| --- | ----------------------------- | ---------- | ------------------------------------------------------- |
| 1.1 | Typed style definitions       | Scaffold   | Validated, ordered style data through `Style.define`    |
| 1.2 | Literal CSS compilation       | 1.1        | Pure `Css.compile` with readable, deterministic classes |
| 1.3 | Static source extraction      | 1.2        | Literal `css()` calls resolved without executing code   |
| 1.4 | Module rewriting and maps     | 1.3        | Executable modules, CSS, and source locations           |
| 1.5 | Host adapters and portability | 1.4        | File/watch fixture and cross-environment core proof     |

### PR 1.1 — Typed Style Definitions

- [x] Replace the greeting export and unit test with `Style.define`, public types, colocated `Style.test.ts` integration scenarios and `Style.test-d.ts` consumer type fixtures. Wire both into existing test/type-check commands; retain the repository tooling.
- [x] Establish real compiler benchmarks for Tailwind, StyleX, and vanilla-extract with bundled CSS/JavaScript size reports. Add Zyzz to the corpus in PR 1.2 when its CSS emitter exists.
- [x] Define immutable, ordered declaration data and structured diagnostics independently of parsers and emitters. Keep source locations optional so in-memory callers need no source files.
- [x] Establish a documented literal declaration subset covering layout, spacing, sizing, colors, borders, and typography. Check property names and value domains without a permissive index signature; accept literal lengths, valid unitless numbers, and CSS zero.
- [x] Keep the root token-free and target-independent. Reserve the domain-owned token-reference boundary for Phase 2 without introducing theme data, token resolution, callbacks, selectors, or queries in this PR.

Acceptance: public consumer scenarios prove inference, ordered immutable data, and actionable validation errors through real modules. Consumer type fixtures run in CI; compiler comparisons have reproducible fixtures and reports. The root dependency graph contains no themes, target emitters, parsers, filesystem access, or framework runtimes.

Evidence: [PR #1](https://github.com/wevm/zyzz/pull/1); `pnpm check`, `pnpm check:types`, `pnpm build`, and all integration scenarios pass. The separate Benchmarks workflow uploads reports and host metadata as CI artifacts; [reproduction instructions](../bench/README.md) and the [literal contract](../docs/literal-styles.md) are tracked. Zyzz browser rendering and CSS-output benchmarks start with PR 1.2.

### PR 1.2 — Literal CSS Compilation

- [x] Add the named `Css` namespace at `zyzz/web` and implement pure `Css.compile({ styles })` for the literal subset. Return the architecture's `{ css, classes, themes }` shape with an empty theme map and structured `Css.CompileError` diagnostics.
- [x] Serialize valid CSS values and property names, retaining authored declaration order. Factor nonconflicting declaration domains and retain ordered conflicting rules; general atomic optimization remains in Phase 3.
- [x] Generate readable deterministic class names with collision handling. Keep identity independent of machine paths, traversal order, clocks, and global mutable state; repeated isolated calls must agree.
- [x] Add the real Zyzz compiler to the shared Tailwind, StyleX, and vanilla-extract compilation corpus in `bench/Compilation.ts`. Measure minified emitted CSS and required browser JavaScript separately in raw, gzip, and Brotli bytes; retain the same literal workloads and verify equivalent computed styles before reporting deltas. Do not compare `Style.define` validation with compilation.
- [x] Add integration fixtures from public definitions through the real compiler and browser for deterministic output, escaping, unit handling, collisions, and order-sensitive shorthand/longhand declarations. Verify computed styles and establish compilation-time and emitted-byte baselines on the same corpus.

Acceptance: in-memory definitions produce usable CSS and matching class names without source parsing or file access. Unsupported features fail explicitly. Root imports do not pull in the web compiler.

Evidence: [PR #3](https://github.com/wevm/zyzz/pull/3) merged as `2a366cd`. Build, checks, browser integration tests, and all 40 benchmarks passed. Eight workloads compare five compiler adapters. Small, repeated, unique-padding, and partial-sharing workloads gate total raw/gzip/Brotli delivery below every comparison library. Other workloads retain measured gaps. These are literal-pipeline results, not source-extraction or whole-application comparisons.

### PR 1.2a — Conflict Graph and Safe Local Sharing

Status: planned after PR 1.2; implementation does not require source extraction.

- [ ] Retain declaration occurrence identities and construct precedence constraints for the supported literal subset. Treat arbitrary classes as potentially coexisting; preserve shorthand/longhand and A/B/A behavior.
- [ ] Generate bounded shared-subset candidates using selector/declaration incidence indexes. Support whole-style and atomic candidates as alternatives; do not introduce declarations on unrelated selectors.
- [ ] Select profitable local merges and schedule them without violating required edges. Add deterministic candidate limits and baseline fallback; keep core pure and dependency-free.
- [ ] Add public browser integration scenarios for sharing before a later override, repeated conflicting values, overlapping candidates, and exhausted budgets. Keep snapshots inline and independently verify computed declarations.
- [ ] Measure all eight unchanged workloads against all existing libraries. Record CSS, class references, client JavaScript, total raw/gzip/Brotli bytes, and compilation timing; retain existing gates and report remaining losses.

Acceptance: safe local sharing is possible despite conflicting values elsewhere, with deterministic output and no change to cascade behavior. Improvements must be measured rather than inferred from fewer rules.

### PR 1.2b — Bounded Search and Candidate Scoring

Status: planned after PR 1.2a.

- [ ] Add bounded lookahead or beam search over safe candidates, with deterministic tie-breaking and explicit limits on candidates, expansions, and memory. Do not let wall-clock timing change normal output.
- [ ] Estimate complete delivery costs and recompute marginal savings for overlapping candidates. Keep the baseline and a bounded shortlist; do not expose a general plugin framework or premature public optimizer API.
- [ ] Validate fallback behavior and alternate schedules through real public compiler/browser flows. Measure compile-time overhead and size deltas in sequential matched runs.
- [ ] Run an isolated solver experiment on small real fixture families to assess missed opportunities. Keep solver dependencies outside production and never label a candidate-space optimum a global compressed optimum.

Acceptance: search remains bounded and repeatable, preserves correctness and current gates, and demonstrates gains over the simpler greedy strategy or retains that strategy.

### PR 1.3 — Static Source Extraction

- [ ] Add the token-free `css` authoring signature for literal objects. An untransformed call fails with an actionable missing-transform error; it never generates styles at runtime. Dynamic binding callbacks and richer value syntax remain in Phase 2.
- [ ] Implement parser-owned binding analysis over supplied source text. Recognize direct and renamed imports from `zyzz`, and distinguish shadowed bindings and unrelated functions named `css`.
- [ ] Extract direct literal calls wherever they occur, including inline markup and exported constants, into the same ordered data consumed by `Css.compile`. Require host-supplied portable module identity instead of reading the environment.
- [ ] Diagnose dynamic values, spreads, unsupported callbacks, and unresolved definitions with source spans. Run real extraction-to-compilation scenarios proving extraction never executes application code, and benchmark that pipeline. Imported style definitions, theme bindings, and broader static evaluation remain in Phase 2.

Acceptance: supported source calls and equivalent in-memory definitions produce equivalent compiler input and CSS. Token names and numeric spacing tokens fail in root calls; unrelated bindings remain untouched. Parsers stay outside core and target entrypoints.

### PR 1.4 — Module Rewriting and Maps

- [ ] Replace extracted definitions with callable props binders; fold fully static applications to `{ className }` props objects when safe and return transformed source, stylesheet artifacts, and source maps from an adapter operating on strings and plain data.
- [ ] Preserve surrounding application code, exports, and source semantics. Remove authoring imports only when their bindings are no longer needed; leave no styling authoring closures or runtime CSS generation; surviving static callables only merge props.
- [ ] Verify static callable props merging through real module/browser scenarios: preserve generated classes, merge caller styles, reject unrelated props and direct owned-attribute overrides, retain packed exports, and measure surviving callable cost.
- [ ] Connect generated classes, declarations, and diagnostics to authored locations. Keep identities and output stable across repeated transforms with the same inputs.
- [ ] Add an end-to-end fixture that transforms source, loads the resulting module and CSS, and verifies rendered styles in a real browser. Cover inline calls, exported props constants, and consumption of those compiled exports by another module. Measure full-transform latency and generated JavaScript/CSS sizes.

Acceptance: transformed modules run without invoking the missing-transform stub, their classes match emitted CSS, and source maps locate the original styles. No filesystem or build-tool integration is required to use this adapter.

### PR 1.5 — Host Adapters and Portability

- [ ] Add a minimal file host and fixture driver around the source adapter for reads, output writes, and watch invalidation. Keep the public CLI and build-tool integrations in Phase 4; do not add another compiler path or general plugin system.
- [ ] Handle source additions, edits, removals, and renames for the supported literal subset. Exclude output directories, preserve the previous successful output on failure, and clean up only host-owned artifacts.
- [ ] Run identical pure-data fixtures across server, browser, worker, and a native JavaScript engine. Verify matching results and imports without environment shims; native stylesheet emission remains in Phase 3.
- [ ] Verify packed root/web entrypoints, source-first declarations, and dependency isolation. Use real temporary files, processes, and watchers for recovery/disposal scenarios; measure cold builds and edit-to-artifact latency separately. Document how integration tests and benchmarks run with existing tooling.

Acceptance: source edits update both modules and CSS, failed rebuilds preserve working artifacts, and deletion removes stale owned output. Portability checks demonstrate the core is independent of the host. No public CLI, theme, or native styling capability is claimed complete.

Gate: identical public-pipeline results across real server, browser, worker, and native-engine fixtures. Core imports do not pull in bundled themes, parsers, frameworks, rendering targets, or file access. Integration and consumer type fixtures pass without mocks or stubs, and relevant benchmark baselines are recorded.

## Phase 2 — Standard authoring and themes

Status: planned.

- [ ] Implement the `Theme.define` and `Theme.extend` contracts before widening authoring syntax.
- [ ] Add `zyzz/themes/default` with named `css`, `theme`, and raw `tokens` exports; add bound `variants` when recipe compilation lands in Phase 3. Bundle colors, typography, spacing, radii, and related scales using the ordinary theme contract; keep light/dark values within the theme.
- [ ] Preserve inference and extraction for bundled `css` aliases and re-exports. Verify parity with `theme.css`, explicit token composition, and use of the exported theme with target compilers. Apply the same alias contract to `variants` in Phase 3.
- [ ] Accept token groups directly with no metadata or scheme container. Each color leaf is `string | { light: string; dark: string }`; require both fields for pairs.
- [ ] Infer `theme.css` arguments from shared `color` and property-specific `backgroundColor`, `textColor`, and `borderColor` groups, with documented fallback and override rules. Reject wrong domains, unknown tokens, partial pairs, and incompatible extensions.
- [ ] Derive internal theme identities without caller metadata; extensions retain base token identities independently of values. Switching theme scopes must not require recompiling component classes.
- [ ] Make bound styles work without a root scope using custom-property fallbacks; expose `theme.className` for inherited overrides and retain token-free `css` from the root entrypoint.
- [ ] Implement trailing `!`/`!important` parsing and ordered nonempty fallback arrays. Validate suffixes, quoted/escaped exclamation marks, numeric values, token resolution, mixed fallback importance, invalid arrays, and native capability rejection without executing application code.
- [ ] Accept ordinary strings and untagged template literals for CSS expressions. Fold static primitive interpolations and preserve recognized variable references; reject unknown object coercions, unresolved runtime values, and arbitrary function calls. Cover equivalent literal/template output, source diagnostics, variable liveness, and target validation.
- [ ] Expose inferred `theme.vars` references for scalar declaration tokens on web. Emit CSS `var()` values with defining fallbacks and shared theme identities; preserve TypeScript domain checking in direct properties and compiler reference analysis within template expressions. Exclude query metadata and composite presets, and reject these references on native.
- [ ] Verify `theme.vars` inference, unknown paths, incompatible domains, absence of implicit root theme data, bundled/custom themes, inherited overrides, light/dark fallbacks, variable liveness, and removal of authoring callbacks from generated modules.
- [ ] Define numeric token/literal behavior, keyword precedence, ordered fallbacks, expression references, and explicit token references and CSS literals. Verify that root calls accept standard lengths, unitless values, and CSS zero while rejecting undeclared named/numeric tokens, even when a theme is imported elsewhere.
- [ ] Implement optional branded `ClassName<Properties>` types across exports, conditions, and shorthand expansion.
- [ ] Implement `Vars.define`/`Vars.set` with typed web bindings and explicit native support; separate runtime value assignment from style generation.
- [ ] Implement dynamic `css((values: Values) => style)` with an explicitly typed values record and callable web props output. Object definitions are also callable. Accept runtime values and styling overrides in one input, consume the full declared finite key set, reserve merge keys, and reject unknown inputs instead of forwarding props. Share binding slots with `Vars` and publish callable declarations across packed libraries.
- [ ] Extract dynamic scalar positions without executing callbacks. Emit fixed CSS-variable rules and small binding functions; reject dynamic rule structure, token lookup, optional/null leaves, arbitrary calls, and unsupported expressions. Specify primitive validation, private variable isolation, static fallback restrictions, and explicit binding composition.
- [ ] Add real source-to-browser integration scenarios for callback values, pseudo/query rules, nested instances, theme changes, server rendering/hydration, and packed callable exports. Prove stable classes/rule count after repeated updates and removal of authoring callbacks. Check input inference, callable static/dynamic props, consumed-key removal, override rules, reserved keys, and rejected className misuse through consumer fixtures and benchmark binding time, CSS/JavaScript bytes, and browser recalculation.
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
- [ ] Preserve standard declaration order, selectors, at-rules, inheritance, and cascade semantics. Specify token/literal precedence and retain authored condition order.
- [ ] Support same-module immutable definitions and spreads through static binding analysis; add imported definitions only with explicit resolution and cycle errors.

Gate: two compatible themes each work in both schemes. Switching a scope changes colors and shared tokens through CSS alone. Nested themes and explicit schemes behave as specified. Inline and exported styles retain inference. Dynamic callbacks bind typed values to fixed rules with stable classes, and static definitions remain callable with optional styling overrides; browser integration and binding benchmarks verify both. Nested selectors and raw/aliased queries preserve CSS semantics; invalid definitions fail without evaluating application code.

## Phase 3 — Composition, variants, and target output

Status: planned.

- [ ] Prefer native/ARIA state attributes and custom data attributes; retain `cx` for explicit last-wins composition within matching contexts.
- [ ] Make `cx` consume and return props objects, preserving bindings and recipe attributes. Prove static/dynamic composition across package boundaries, repeated variable-key precedence, equal-class/different-value calls, partial shorthand overrides, conditions, fallback groups, and external-class limitations. Verify discarded declarations cannot remove still-live variables and that metadata never leaks into DOM props; no runtime rule generation or global registration.
- [ ] Implement token-free `variants(definition)` and bound `theme.variants(definition)` with direct/default-theme exports, destructured/imported alias parity, inferred selection types through `Parameters`, base/variants/compounds/defaults, boolean selections, array compound matches, and styling overrides under the same merge contract as `css`.
- [ ] Compile web recipes to stable classes and scoped data-attribute selectors; dynamic calls serialize selections and bind active payloads only. Validate attribute ownership, null/default behavior, and ordered precedence.
- [ ] Add typed callbacks within variant choices and scoped payload selections such as `{ size: { custom: { padding: '12px' } } }`. Require exactly one dynamic choice and a valid payload; infer its discriminated union through `Parameters`. Defaults require complete static payloads; compounds match names, not values.
- [ ] Share dynamic `css` binding slots and validation with variant callbacks. Scope variables per recipe/axis/choice, support scalar padding expansion with partial override correctness, and reject unsupported shorthands. Never generate rules per value.
- [ ] Add real browser/native integration scenarios for choice transitions, removed bindings, defaults/null, compound matches, same-named inputs across axes, nested instances, schemes, overrides, and packed consumers. Include rejected payload/override type fixtures and selection/binding benchmarks with fixed rule/table counts.
- [ ] Implement shared native recipe selection with the same inferred props and precedence; avoid unbounded variant/theme Cartesian products.
- [ ] Extend the pure `Css.compile` introduced in PR 1.2 for composition and variants, preserving the theme and conditional semantics established in Phase 2. Retain the named `Css` export from `zyzz/web`; theme maps name outputs without adding definition metadata.
- [ ] Emit deduplicated atoms with readable property/token/condition names and deterministic collision suffixes, retaining names in production.
- [ ] Preserve ordered groups for conflicting declarations and conditions; verify cascade equivalence before deduplication. Include resolved query thresholds in identity and retain authored condition order.
- [ ] Prune unreachable rules and unused variables while retaining complete live token sets in theme scopes.
- [ ] Export `StyleSheet` as a named namespace from `zyzz/react-native`. Implement `StyleSheet.compile` as a pure emitter returning complete static tables for every requested theme/scheme pair, with errors owned by the same namespace.
- [ ] Implement `StyleSheet.select` as a lookup only. System scheme, interaction, viewport, and accessibility inputs belong to application or host adapters.
- [ ] Prove the same named style definitions with shared tokens on web and native before expanding coverage.
- [ ] Specify native unit conversion and font handling; require explicit configuration where no portable default exists.
- [ ] Document target support for selectors, queries, custom properties, CSS functions, text inheritance, units, and state. Unsupported semantics must fail rather than disappear silently.
- [ ] Bind dynamic callback slots through the native adapter using the same explicit property/unit capabilities as `Vars`. Exercise real native updates and rejected web-only expressions without CSS parsing or rule generation.
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
- [ ] Measure compilation, incremental updates, type-check cost, raw/compressed CSS, callable/props-merging overhead, class-string bytes, total transfer, browser style recalculation, and native adapter cost independently.
- [ ] Measure theme multiplication and generated-table size; deduplicate without changing observable theme or cascade semantics.
- [ ] Require combined emitted CSS and client JavaScript to beat StyleX in matched raw/gzip/Brotli workloads as each capability lands. Expand the existing literal size gate to themes, variants, selectors, and library consumers; preserve CSS behavior and readable names.
- [ ] Compare atomic and grouped output on repeated and unique styles; optimize the smaller safe representation. Measure the agreed variant API; defer additional recipe abstractions and slot systems until concrete usage justifies them.
- [ ] Verify package metadata and the standard changeset/release workflow.

Benchmarks begin in PR 1.1 and grow with each real pipeline; this phase consolidates the evidence. Follow `AGENTS.md`: save machine-readable baselines, record measurement conditions and variability, validate equivalent behavior, and report CSS, JavaScript, markup/class bytes, compression, and runtime helpers without double-counting. Use real browser/native measurements for rendering and selection workloads.

Gate: a small documented API, tested compatibility matrix, reproducible measurements, and working independent web/native consumers.

## Acceptance matrix

| Area           | Required proof                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Core           | In-memory operation without environment, framework, parser, or build-tool dependencies                                            |
| Types          | Named styles and token domains infer precisely; invalid schemes and overrides fail                                                |
| Themes         | Colors accept shared strings or light/dark pairs; extensions share inferred token identities                                      |
| Entry points   | Root `css` is token-free; opt-in theme exports preserve inference and identity without implicit theme imports                     |
| Web scopes     | Custom-property inheritance, nested themes, and explicit/system schemes work without a theme runtime                              |
| Native schemes | Every theme/scheme pair is precompiled; selection is a deterministic lookup                                                       |
| Standards      | CSS values, selectors, at-rules, declaration order, and cascade retain their semantics                                            |
| Integration    | Document, component, template, native, server, and library consumers share the same contracts                                     |
| Minimalism     | No required providers, wrappers, global setup, platform detection, or runtime compilation                                         |
| CLI            | Standalone compilation rewrites calls, emits CSS, and matches other adapters; watch recovers from errors                          |
| CSS output     | Readable stable names, collision safety, small measured artifacts, and unchanged cascade behavior                                 |
| Authoring      | Inline, module-level, and exported/imported styles share inference and compilation                                                |
| Queries        | Correct alias completion, raw query support, static thresholds, containment, nesting, and precedence                              |
| Variants       | Direct/theme-bound definitions, inferred props, attribute output, scoped dynamic payloads, defaults, compounds, and native parity |
| Composition    | Documented last-wins resolution with metadata, partial overrides, and no rule generation                                          |
| Variables      | Typed dynamic callbacks and explicit variables, fixed rules, and native binding capabilities                                      |

## Scope

The API and phases above are proposed. Implementation begins at Phase 1 with no retained code baseline. Build each capability and its acceptance fixtures before marking its phase complete.

## Benchmark Expansion

Status: eight literal workloads and five real compiler adapters are implemented on PR 1.2. Panda CSS joins the existing adapters. Tamagui has been removed from the PR matrix due to extraction cost; no additional styling libraries are authorized. Browser equivalence covers every workload. Existing size gates remain; discovery cases expose further optimization targets.

- [ ] PR 1.3–1.5: add cold-process source builds, warm builds, unchanged edits, new styles, removed styles, and imported-dependency edits. Include parsing, scanning, rewriting, and output writing explicitly. In-memory emission must remain a separate measurement.
- [ ] PR 1.5: add opt-in 10/100/1,000/10,000-style sweeps and independently vary rendered instance count. Keep expensive runs outside the short PR matrix.
- [ ] Phase 2: add basic/complex themes, nested scopes, forced/system schemes, query density, and independent dynamic values. Measure rule growth, CSS-variable assignment, and style recalculation in real browsers.
- [ ] Phase 3: add default/compound variants, variant changes, consumed-value updates, unchanged parent rerenders, and override-heavy composition. Verify comparable cascade semantics before comparing shorthand and A/B/A composition across libraries.
- [ ] Phase 3–4: adapt deep/wide component trees and dynamic triangle workloads using real production framework runtimes. Separate mount, cached rerender, changed props, CSSOM writes, layout, paint, and interaction latency. Do not substitute raw DOM timing for framework runtime cost.
- [ ] Phase 4: add SSR throughput and full HTML/CSS/JavaScript delivery, hydration, route splitting, dead-style removal, and packed-library boundaries. Keep framework baseline and incremental styling cost visible without double-counting assets.
- [ ] PR 1.2 onward: optimize every workload against Panda CSS, StyleX, Tailwind, and vanilla-extract and promote measured cases to regression gates. Record all raw/gzip/Brotli results, including losses; do not change fixtures to manufacture wins.

The benchmark implementation and reproduction notes record prior-art attribution. Later workloads must use actual supported APIs, without mocks, replacement compilers, or placeholder zero results.

### Optimization Follow-Through

- [ ] PR 1.4 onward: score the bounded shortlist using the actual source emitter, minifier, and separately compressed CSS/JavaScript. Start with total gzip and explicit raw/Brotli budgets. Keep compression in host adapters with reproducible settings and the same policy across development and production.
- [ ] Phase 2: extend conflict proofs to supported conditions, theme scopes, importance, and fallback sequences before enabling associated transformations.
- [ ] Phase 3: exploit proven exclusivity of variant attribute values on the same element; preserve conservative behavior for arbitrary class combinations and ancestor selectors.
- [ ] Phase 4: namespace independently emitted graphs and verify packed-library composition. Evaluate repeated-sequence/dictionary optimization only through actual emitted modules, including reconstruction and runtime costs.
- [ ] Phase 5: investigate equality saturation only if measured rewrite interactions warrant it. Require improvements over bounded graph search before adopting additional machinery.

### Optimization Acceptance

- [ ] Beat each comparison library across all eight workloads in CSS and total raw/gzip/Brotli sizes; retain existing gates while individual targets remain open. Prioritize palette and component reuse, sparse factoring overhead, and independent-value compression. Preserve shorthand and A/B/A cascade semantics.
- [ ] Confirm timing improvements in repeated matched runs, then set tolerances from measured variance. Do not assert fastest from a noisy CI sample or hide the differing source-pipeline boundaries.
- [ ] Measure compact emitted module serialization through the production source adapter when it lands; do not add benchmark-only pooling or special cases.
