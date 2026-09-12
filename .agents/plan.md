# Implementation plan

## Runtime Render Performance — Immediate Priority

[PR #74](https://github.com/wevm/zyzz/pull/74) adds production React mounts, changed-prop updates, and remounts through Vitest Browser Mode in Chromium. Matched native, Panda, StyleX, Tailwind, vanilla-extract, and Zyzz applications verify computed styles and DOM identity outside timing. Function microbenchmarks remain diagnostics.

- [x] Implement 100/1,000-card fixtures, forward/reversed passes, raw samples, and same-runner base comparisons.
- [ ] Complete browser validation and establish repeatability before introducing render timing regression gates.
- [ ] Extend the suite with equivalent variant recipes when their supported implementation lands.

Commit and forced-layout timings are distinct from frame checkpoints. Cold navigation, hydration, exact paint CPU time, and unchanged rerenders remain separate workloads. No fastest-framework claim follows from function timings.

## Current CSS Conformance Contract

CSS property/value validation is static only. Remove runtime CSS validators rather than adding a development mode. Retain source extraction, ordered-data, and theme graph structural diagnostics. Browser parsing owns value semantics beyond the static types.

The consolidated PR maps 670/670 properties: 670 reviewed as supported, 0 partial, and 0 deferred. The strict 100% gate remains active. Static hex/integer/nonnegative literal checks and image/URL declarations extend the independent grammar and public consumer corpus. Browser evidence remains required for applicable properties.

## Static Template Values

[PR #64](https://github.com/wevm/zyzz/pull/64) folds untagged template text and literal primitive substitutions, including signed numbers, TypeScript assertions, nesting, fallbacks, and importance. Integration/type fixtures and extraction benchmarks cover this boundary.

Recognized theme variable interpolation and immutable module-level literal bindings are implemented. Arbitrary evaluation, imported static records, dynamic fallback groups, and native bindings remain separate gates.

Local validation: ten extraction/transform integrations, native type/lint checks, package build, and the 670/670 gate pass. Ordinary TypeScript and browser verification remain with CI. Matched 10/100/1000-style extraction means: 0.873/11.500/72.863 ms before and 0.851/9.489/74.794 ms after; uncertainty overlaps. The template fixture measures 0.371 ms. No speedup is established.

## Phase 2 Delivery and Acceptance

| PR                                          | Scope                                       | Tested head                                                                             | Verification                                                             | Benchmarks                                                               |
| ------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| [#81](https://github.com/wevm/zyzz/pull/81) | Callable named-theme selection              | [9f0e115](https://github.com/wevm/zyzz/commit/9f0e115b5a2c660c010f28f44369f25361d04938) | [Run 34574510231](https://github.com/wevm/zyzz/actions/runs/34574510231) | [Run 34574509551](https://github.com/wevm/zyzz/actions/runs/34574509551) |
| [#82](https://github.com/wevm/zyzz/pull/82) | Initialization and hydration                | [56ddb26](https://github.com/wevm/zyzz/commit/56ddb262844b3d03fcd3b3e6eba169e8d2a6aa92) | [Run 34574602664](https://github.com/wevm/zyzz/actions/runs/34574602664) | [Run 34574602578](https://github.com/wevm/zyzz/actions/runs/34574602578) |
| [#83](https://github.com/wevm/zyzz/pull/83) | Property mappings and spacing tokens        | [0f79669](https://github.com/wevm/zyzz/commit/0f79669350743553ffbf163f68fc8c87d52c4623) | [Run 34574678371](https://github.com/wevm/zyzz/actions/runs/34574678371) | [Run 34574678049](https://github.com/wevm/zyzz/actions/runs/34574678049) |
| [#85](https://github.com/wevm/zyzz/pull/85) | Typed relationships                         | [1b05ced](https://github.com/wevm/zyzz/commit/1b05cedc87480cb96e3de93f09b64480ca652f2f) | [Run 34575334099](https://github.com/wevm/zyzz/actions/runs/34575334099) | [Run 34575333898](https://github.com/wevm/zyzz/actions/runs/34575333898) |
| [#86](https://github.com/wevm/zyzz/pull/86) | Stylesheet completion                       | [7ca6cf5](https://github.com/wevm/zyzz/commit/7ca6cf58db969210d3c329cebdd2a6d8aeb7a831) | [Run 34575405249](https://github.com/wevm/zyzz/actions/runs/34575405249) | [Run 34575405024](https://github.com/wevm/zyzz/actions/runs/34575405024) |
| [#87](https://github.com/wevm/zyzz/pull/87) | Registered variables and extraction         | [88d659d](https://github.com/wevm/zyzz/commit/88d659d3e2a3f7bb54a27b86912ae8130f1e0b12) | [Run 34575482212](https://github.com/wevm/zyzz/actions/runs/34575482212) | [Run 34575481925](https://github.com/wevm/zyzz/actions/runs/34575481925) |
| [#90](https://github.com/wevm/zyzz/pull/90) | Acceptance and documentation reconciliation | [390afe5](https://github.com/wevm/zyzz/commit/390afe592d6a6f6388bd6c15fd3a8db4947bdf0f) | [Run 34578795200](https://github.com/wevm/zyzz/actions/runs/34578795200) | [Run 34578795005](https://github.com/wevm/zyzz/actions/runs/34578795005) |

Feature PRs #81, #82, #83, #85, #86, and #87 are merged. Their rows preserve historical runs, including failed verification on #86 and #87; the snapshot failures and subsequent review findings are corrected in #90. The #90 row pins an integrated verification and benchmark snapshot. Later review corrections are validated at the current PR head; the row is historical evidence, not a claim about a newer commit. Merge acceptance requires successful verification and benchmark checks at the current #90 head, recorded in its PR description. Verification includes consumer types, builds, browser integration, packaging tests, and strict CSS conformance. Benchmark runs include matched compiler workloads and production React rendering.

Checked implementation items below do not close broader browser, native, framework, or benchmark acceptance gates. Variants, native bindings, generic/imported dynamic types, and imported arbitrary static records retain explicit later gates.

Matched extraction evidence: 100-style configuration graph, same machine, sequential baseline/candidate, 30 minimum iterations and 500 ms warmup. Means were 9.069 ms ±5.46% and 8.555 ms ±4.49%; uncertainty overlaps. No performance advantage is established.

The feature stack followed framework PR #79: callable named-theme selection, root initialization script, property mappings and margin/padding groups, typed relationship helpers, stylesheet completion, and variable/extraction completion. PR #90 completes acceptance reconciliation and review follow-ups on main. Vue remains deferred.

Stylesheet completion adds imported/re-exported animation identities, packed eager contributions, shared source maps, source-relative assets in Vite and the standalone host, and the opt-in layered reset. Integration fixtures exercise binary asset relocation and updates, packed contributions, shared source maps, and Vite development/production delivery. The linked verification runs include their browser and packaging checks.

Typed marker, ancestor, descendant, and all three sibling helpers now carry finite state schemas through aliases and packed contracts. Selectors retain zero predicate specificity. Runtime applications emit data attributes only. Source, packed-contract, consumer-type, and browser fixtures cover these helpers; larger relational benchmark and hydration combinations remain explicitly unchecked below.

Property mappings support explicit ordered aliases on config CSS and bound theme handles, including packed contracts, nested declarations, dynamic slots, source maps, and dedicated margin/padding token precedence. Consumer fixtures cover React/HTML output through aliases and extensions; packed compilation and Chromium fixtures verify ordered expansion and token precedence. Variants retain their separate deferred implementation gate.

Callable named selections support destructured exports, aliases/re-exports, packed contracts, default token references, and React/HTML props. Seven focused linked/packed/renderer regressions, three configuration integrations, focused lint/types, and the package build pass locally. Matched 100-style config graph means: 10.138 ms ±10.81% before and 9.197 ms ±7.81% after; uncertainty overlaps. Chromium fixtures verify local and packed React/HTML selection, nested scopes, schemes, and stable component classes in CI. Initialization and hydration are implemented in PR #82.

### Root Appearance Initialization

Config-bound `script({ storageKey }?)` now serializes HTML-safe synchronous restoration using compiled scope classes. Named, single-theme, and token-free modes retain server defaults when storage is missing, malformed, blocked, or has invalid fields. Catalog matching uses own names; unrelated root classes/styles are preserved.

Five packed selection/script tests, 58 graph integrations, focused lint/types, and the package build pass locally. The 100-style configuration graph measured 9.197 ms ±7.81% before and 8.841 ms ±6.35% after; uncertainty overlaps. Real-origin browser fixtures cover field independence, CSP hashes, execution before body parsing, blocked storage, and React hydration identity. The linked CI runs execute these browser fixtures and the full TypeScript checks with the required dependencies installed.

## Phase 2 PR Stack

1. Theme variable references: typed direct values and template interpolation, live fallbacks, imported/config/packed contracts. Standalone variable destructuring remains deferred.
2. Explicit variable contracts and assignments: module-level schemas compile to fixed, isolated slots; typed partial assignments return ordinary inline properties. Imported style references now retain packed identities; native bindings remain deferred.
3. Dynamic style bindings: finite inline scalar parameter types, fixed private slots, static declarations, exact inputs, and compiled callable type preservation. Finite local aliases, interfaces, and object intersections are supported. Dynamic fallback groups and native bindings remain deferred.
4. Bundled themes and query thresholds: opt-in palette/scales, scalar typography, and separate packed query metadata. Alias condition emission follows in the dependent conditions PR.
5. Selectors and conditions: native CSS nesting, raw data/ARIA/relationship selectors, query aliases/ranges, and fixed dynamic values. Typed marker helpers now have source, packed, and browser fixtures.
6. Stylesheet contributions.

Each dependent PR targets the preceding branch. CSS value validation remains static-only; structural extraction diagnostics and the 670/670 gate remain active.

### Framework Integration Priority

Bring renderer output and framework source support forward from Phase 4 into Phase 2. Start immediately after the runtime benchmark work in [PR #74](https://github.com/wevm/zyzz/pull/74), preserving [PR #73](https://github.com/wevm/zyzz/pull/73)'s benchmark priority. Complete these integrations before resuming the remaining Phase 2 feature backlog.

Use one shared CSS compiler with thin source and renderer adapters. Keep framework dependencies outside core, preserve React output, and add no custom JSX runtime, provider, component wrapper, or runtime CSS generation. Group fixture styles in `const styles = {}` and consume named config helpers.

Initial support covers React, Vue, Solid, Svelte, and plain DOM/HTML, with Vite and Next.js as application integrations. Remix 3 and React Router are deferred and are not initial acceptance gates.

Follow with Nuxt, SvelteKit, SolidStart, Astro, TanStack Start, and Preact integration fixtures. Angular, Qwik, and native rendering remain later work. Base renderer support does not establish application-framework support.

Renderer output uses `Config.create({ output: 'html' })` for direct `styles.card()` binding in Solid, Vue, and Svelte; React props remain the default. Conversion is compiler-owned, with no application-site adapter. Framework integration gates remain open until their dedicated fixtures pass.

Implement in this order:

1. **Renderer output:** define typed output for DOM `class`, `className`, inline style objects, and serialized style attributes. Preserve classes, CSS variables, theme scopes, owned data attributes, escaping, units, existing class/style override merging, and removal of stale values. Verify React and plain DOM consumers through the shared compiler.
2. **Solid:** integrate the existing TSX/Vite path with normal `class` and dash-separated inline style keys. Verify signal-driven updates, dynamic variable bindings, theme/scheme changes, SSR, hydration, and supported refresh behavior.
3. **Vue:** support both imported styles from separate TypeScript modules and authoring in Vue single-file component script blocks. Handle SFC/virtual-module identities, source maps, dependency edits, and normal template class/style bindings without passing template syntax into core.
4. **Svelte:** support imported TypeScript style modules and authoring in Svelte component script blocks. Preserve normal template class/style bindings, reactive updates, source maps, dependency edits, SSR, hydration, and development refresh through the shared compiler.
5. **Next.js:** bring the existing integration and both bundler acceptance gates into Phase 2. Verify the application build and server-rendering paths independently of React renderer support.

Next.js acceptance:

- [ ] Implement `zyzz(nextConfig)` from `zyzz/next` as the single Next.js setup. Preserve existing options and compose build hooks/rules; configure transformation, CSS delivery, and dependency watching internally without requiring separate Babel/PostCSS configuration. Reuse the shared compiler and keep loader/transform selection internal.
- [ ] Verify Next.js Webpack and Turbopack independently: Server Components, client components, streaming, hydration identities, Fast Refresh, route navigation, imported config/theme edits, production CSS loading, and failure recovery. Record supported Next.js versions and finalize async/function-valued config support before documenting it.

For each integration:

- [ ] Add real consumer type fixtures and browser integration coverage for static styles, dynamic bindings, existing class/style override merging, themes, and color schemes. Extend these fixtures with `cx` composition and variants when their Phase 3 APIs land; neither blocks Phase 2 integrations.
- [ ] Verify mount/update/unmount, computed styles, development CSS updates, production CSS loading, source maps, and add/edit/remove/rename recovery. Require SSR/hydration identity for runtimes that implement hydration. For plain DOM/HTML, verify server attribute serialization and element/style identity across client updates; no hydration lifecycle is required.
- [ ] Exercise packed style/theme consumers and confirm no framework dependency enters core or unrelated renderer output.
- [ ] Record supported framework/build-tool versions and add concise setup examples. Claim support only after the corresponding consumer gate passes.
- [ ] Reuse the browser benchmark harness for relevant renderer/adapter changes, with matched baselines within each framework and untimed correctness checks. Include required helpers and emitted bytes; React results do not prove non-React performance.

Gate: React, plain DOM/HTML, Solid, Vue SFCs, Svelte components, and Next.js render the supported Phase 2 style contracts through their normal APIs using one compiler. Each integration requires passing consumer types, browser rendering, development, production, and packed-consumer evidence before its support claim is published.

Hydrating runtimes also require SSR/hydration identity evidence. Plain DOM/HTML requires server attribute serialization and client-update identity evidence instead. `cx` composition and variants remain Phase 3 extensions to these fixtures.

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

| API                                                   | Contract                                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Config.create(options)`                              | Binds optional inline/reusable themes and ordered layers to inferred `css`/`variants`; encourages `zyzz.config.ts` |
| `css(style)` from `zyzz`                              | Token-free web authoring with standard CSS values; emits spreadable props and static CSS                           |
| `zyzz/themes/default`                                 | Exports bound `css` and `variants`, full `theme`, and raw `tokens` for opt-in bundled styling                      |
| `Style.define(styles)`                                | Defines named, target-independent styles with typed token references                                               |
| `Theme.define(tokens)`                                | Defines token groups; each color is a string or complete light/dark pair                                           |
| `Theme.extend(theme, overrides)`                      | Creates a compatible theme with typed overrides and the same token contract                                        |
| `Css.compile(options)`                                | Emits CSS, named classes, and theme scope classes from in-memory definitions                                       |
| `StyleSheet.compile(options)`                         | Emits static style tables for each supplied theme and color scheme                                                 |
| `StyleSheet.select(styles, options)`                  | Selects an existing theme/scheme table without compiling or merging                                                |
| `theme.css(style)`                                    | Infers property-specific tokens and compiles directly to props containing readable classes                         |
| `css((values: Values) => style)`                      | Compiles static rules and returns a typed callable web class/style binding                                         |
| `variants(definition)` / `theme.variants(definition)` | Defines token-free or theme-bound recipes with inferred selection props                                            |
| `theme({ colorScheme })` / `theme.className`          | Callable web scope props with optional scheme; raw compiled class remains accessible                               |
| `zyzz build` / `zyzz watch`                           | Standalone module rewriting and stylesheet emission; defaults: `src`, `dist`, `dist/styles.css`                    |

The accepted [configuration contract](architecture.md#configuration-and-inferred-authoring) retains `Theme.define` and supports mutually exclusive `theme`/`themes`, an inferred named default, normalized scope handles, and direct `@layer <name>` keys. Theme scope classes select inherited CSS variables; `colorScheme` selects light/dark independently.

Consumer documentation lives under [docs](../docs/README.md), with separate concepts, usage, and API references. Each page distinguishes current contracts from API previews.

Additional agreed APIs are callable static `css(style)`, `cx(...)`, `Vars.define`/`Vars.set`, optional `ClassName<Properties>` contracts, and `fontFace`/`global`/`keyframes`/`layers`. Export `css` and `variants` directly and bind both on themes. Export `fontFace`, `global`, `keyframes`, and `layers` directly from `zyzz/web`; keep `Css` for pure web compilation. Extract recipe props with `NonNullable<Parameters<typeof button>[0]>`; no variant namespace or props helper is needed.

Import platform APIs as named namespaces: `Css` from `zyzz/web` and `StyleSheet` from `zyzz/react-native`. Shared style definitions remain under `Style` from `zyzz`; the root has no dependency on either target namespace.

Every `css` definition is callable. Static calls accept optional styling overrides; dynamic callbacks receive a typed values record, and applications combine those values and `className`/`style` overrides in one input. Calls return spreadable props. Consumed keys are stripped; classes and inline styles follow the architecture merge rules. Use trailing `!` and fallback arrays, with `theme.tokens` and `theme.vars` for explicit references. Other component props remain on the component. There is no context parameter.

## Starting point

Phase 1 is merged: typed definitions, literal CSS emission, source extraction, module rewriting, file hosts, and portability coverage. Phase 2 includes merged in-memory themes, token-name authoring, and relative source graph linking; incremental graph compilation, Vite 8 integration, standalone Lightning CSS processing, and lazy physical modules are merged. Packed themes (#23), configuration core contracts (#24), and configuration source integration (#27) are merged. Work is in 2.3: declaration fallbacks (#28), standard length units (#29), logical boxes (#33), flex/overflow (#35), borders/outlines (#37), intrinsic sizing (#38), scroll spacing/behavior (#41), scroll snapping (#42), text flow/spacing (#43), and text decorations (#44) are merged. Table properties (#46) are merged. Interaction properties are the current follow-up; later Phase 2 acceptance gates remain open.

Zile builds and links the library; Vite Plus runs oxfmt, oxlint, and integration tests. Existing CI checks consumer type fixtures, runs integration scenarios and builds the package. Tooling remains outside the core dependency graph.

## Phase 1 — Build the core

Status: complete. PRs 1.1–1.5 are merged. Testing and benchmark conventions are defined in `AGENTS.md`.

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

Evidence: [PR #1](https://github.com/wevm/zyzz/pull/1); `pnpm check`, `pnpm check:types`, `pnpm build`, and all integration scenarios pass. The separate Benchmarks workflow uploads reports and host metadata as CI artifacts; [reproduction instructions](../bench/README.md) and the [literal contract](../docs/api/core/Style/literals.md) are tracked. Zyzz browser rendering and CSS-output benchmarks start with PR 1.2.

### PR 1.2 — Literal CSS Compilation

- [x] Add the named `Css` namespace at `zyzz/web` and implement pure `Css.compile({ styles })` for the literal subset. Return the architecture's `{ css, classes, themes }` shape with an empty theme map and structured `Css.CompileError` diagnostics.
- [x] Serialize valid CSS values and property names, retaining authored declaration order. Factor nonconflicting declaration domains and retain ordered conflicting rules; general atomic optimization remains in Phase 3.
- [x] Generate readable deterministic class names with collision handling. Keep identity independent of machine paths, traversal order, clocks, and global mutable state; repeated isolated calls must agree.
- [x] Add the real Zyzz compiler to the shared Tailwind, StyleX, and vanilla-extract compilation corpus in `bench/Compilation.ts`. Measure minified emitted CSS and required browser JavaScript separately in raw, gzip, and Brotli bytes; retain the same literal workloads and verify equivalent computed styles before reporting deltas. Do not compare `Style.define` validation with compilation.
- [x] Add integration fixtures from public definitions through the real compiler and browser for deterministic output, escaping, unit handling, collisions, and order-sensitive shorthand/longhand declarations. Verify computed styles and establish compilation-time and emitted-byte baselines on the same corpus.

Acceptance: in-memory definitions produce usable CSS and matching class names without source parsing or file access. Unsupported features fail explicitly. Root imports do not pull in the web compiler.

Evidence: [PR #3](https://github.com/wevm/zyzz/pull/3) merged as `2a366cd`. Build, checks, browser integration tests, and all 40 benchmarks passed. Eight workloads compare five compiler adapters. Small, repeated, unique-padding, and partial-sharing workloads gate total raw/gzip/Brotli delivery below every comparison library. Other workloads retain measured gaps. These are literal-pipeline results, not source-extraction or whole-application comparisons.

### PR 1.2a — Shared Minification Baseline

Status: implemented in [PR #5](https://github.com/wevm/zyzz/pull/5) from main `768b700`. Build, checks, browser integration/size gates, and all 40 benchmarks pass in CI. Custom optimizer work is deferred.

- [x] Route every benchmark adapter's final CSS through the same Lightning CSS version, browser targets, and minification settings. Preserve real compiler APIs, required artifacts, unchanged workloads, and disclosure of upstream processing.
- [x] Run browser equivalence checks on the final processed output, including combined classes, shorthand/longhand order, and A/B/A overrides. Preserve existing size gates; investigate changes before modifying any budgets.
- [x] Record raw/gzip/Brotli CSS, required client JavaScript, total transfer, and compilation timings. Compare sequential matched runs; identify residual gaps after standard minification before proposing additional compiler optimization.

Acceptance: all libraries share final CSS processing and retain equivalent browser behavior. A baseline documents remaining gaps; no custom graph optimizer or minifier enters core.

### PR 1.3 — Static Source Extraction

Status: merged in [PR #6](https://github.com/wevm/zyzz/pull/6) as `b538b6b`. Build, checks, browser integration, and benchmarks passed.

- [x] Add the token-free `css` authoring signature for literal objects. An untransformed call fails with an actionable missing-transform error; it never generates styles at runtime. Dynamic binding callbacks and richer value syntax remain in Phase 2.
- [x] Use standalone Oxc parsing and two-pass binding analysis over supplied source text. Recognize direct and renamed imports from `zyzz`, distinguish shadowed bindings and unrelated functions named `css`, and isolate function-body variables from parameter initializers. Keep the scope correction internal and cover it through extraction-to-CSS integration fixtures.
- [x] Extract direct literal calls wherever they occur, including inline markup and exported constants, into the same ordered data consumed by `Css.compile`. Require host-supplied portable module identity instead of reading the environment.
- [x] Diagnose dynamic values, spreads, unsupported callbacks, and unresolved definitions with source spans. Run real extraction-to-compilation scenarios proving extraction never executes application code, and benchmark that pipeline. Imported style definitions, theme bindings, and broader static evaluation remain in Phase 2.

Acceptance: supported source calls and equivalent in-memory definitions produce equivalent compiler input and CSS. Token names and numeric spacing tokens fail in root calls; unrelated bindings remain untouched. Parsers stay outside core and target entrypoints.

### PR 1.4 — Module Rewriting and Maps

Status: merged in [PR #7](https://github.com/wevm/zyzz/pull/7) as `11d79be`. Build, checks, browser integration, packed consumption, and benchmarks pass in CI.

- [x] Replace extracted definitions with callable props binders; fold fully static applications to `{ className }` props objects when safe and return transformed source, stylesheet artifacts, and source maps from an adapter operating on strings and plain data.
- [x] Preserve surrounding application code, exports, and source semantics. Remove authoring imports only when their bindings are no longer needed; leave no styling authoring closures or runtime CSS generation; surviving static callables only merge props.
- [x] Verify static callable props merging through real module/browser scenarios: preserve generated classes, merge caller styles, reject unrelated props and direct owned-attribute overrides, retain packed exports, and measure surviving callable cost.
- [x] Connect generated classes, declarations, and diagnostics to authored locations. Keep identities and output stable across repeated transforms with the same inputs.
- [x] Add an end-to-end fixture that transforms source, loads the resulting module and CSS, and verifies rendered styles in a real browser. Cover inline calls, exported props constants, and consumption of those compiled exports by another module. Measure full-transform latency and generated JavaScript/CSS sizes.

Acceptance: transformed modules run without invoking the missing-transform stub, their classes match emitted CSS, and source maps locate the original styles. No filesystem or build-tool integration is required to use this adapter.

Implementation: `Transform.compile` returns rewritten modules, ordered module-scoped CSS, and standard JavaScript/CSS maps. Direct no-argument applications fold; escaping definitions use the isolated `zyzz/runtime` props binder. Integration scenarios cover source maps, directives, imports, runtime validation, separately compiled browser modules, and packed exports. Browser validation passed in [verification run 34164344672](https://github.com/wevm/zyzz/actions/runs/34164344672). Full-transform and props-binding benchmarks are separate from the existing compiler comparison matrix; emitted sizes include the required runtime.

### PR 1.5 — Host Adapters and Portability

Status: merged in [PR #8](https://github.com/wevm/zyzz/pull/8) as `e870709`. Linux/browser tests, macOS ownership tests, build, checks, and benchmarks passed.

- [x] Add a minimal file host and fixture driver around the source adapter for reads, output writes, and watch invalidation. Keep the public CLI and build-tool integrations in Phase 4; do not add another compiler path or general plugin system.
- [x] Handle source additions, edits, removals, and renames for the supported literal subset. Exclude output directories, preserve the previous successful output on failure, and clean up only host-owned artifacts.
- [x] Run identical pure-data fixtures across server, browser, worker, and a native JavaScript engine. Verify matching results and imports without environment shims; native stylesheet emission remains in Phase 3.
- [x] Verify packed root/web entrypoints, source-first declarations, and dependency isolation. Use real temporary files, processes, and watchers for recovery/disposal scenarios; measure cold builds and edit-to-artifact latency separately. Document how integration tests and benchmarks run with existing tooling.

Acceptance: source edits update both modules and CSS, failed rebuilds preserve working artifacts, and deletion removes stale owned output. Portability checks demonstrate the core is independent of the host. No public CLI, theme, or native styling capability is claimed complete.

Gate: identical public-pipeline results across real server, browser, worker, and native-engine fixtures. Core imports do not pull in bundled themes, parsers, frameworks, rendering targets, or file access. Integration and consumer type fixtures pass without mocks or stubs, and relevant benchmark baselines are recorded.

Evidence: real filesystem integration covers output exclusion, ownership across restarts, changed-file protection, watcher recovery, and disposal. The pure pipeline runs on Node, workers, Chromium, and the QuickJS WebAssembly engine. Packed root/web/runtime consumption is exercised without a compiler plugin. This is embedded-engine portability coverage; Hermes/device rendering remains in Phase 3. Host benchmarks separately measure cold-process rebuilds, unchanged rebuilds, and edit-to-artifact watching.

## Phase 2 — Standard authoring and themes

Next priority: finish the runtime benchmark work, then complete the [Framework Integration Priority](#framework-integration-priority) before resuming the remaining feature backlog.

Current stack: #65 theme variables → #66 explicit variables → #68 dynamic styles → #69 bundled themes/query metadata → #70 nested conditions → stylesheet contribution foundation. These are Phase 2 slices. Remaining acceptance work includes typed relationship markers, bundled variants (Phase 3), imported animation references, relative assets, optional reset, and packed contributions; the broad Phase 2 gates below remain open.

Status: [PR 2.1 / #9](https://github.com/wevm/zyzz/pull/9) and [PR 2.2a / #10](https://github.com/wevm/zyzz/pull/10) are merged. [PR 2.2b.1 / #12](https://github.com/wevm/zyzz/pull/12) is merged. [PR #13](https://github.com/wevm/zyzz/pull/13) adds local bound-authoring aliases. [PR #14](https://github.com/wevm/zyzz/pull/14) adds explicit source token references. [PR #16](https://github.com/wevm/zyzz/pull/16) merged relative source graphs and host dependency rebuilds; PRs #17–#19 add incremental compilation, Vite 8, standalone CSS processing, and lazy modules. [PR #23](https://github.com/wevm/zyzz/pull/23) adds versioned packed-theme metadata, host sidecars, and Vite consumption; its browser, CI, and benchmark gates passed after explicit native light-dark targets. It is merged. [PR #24](https://github.com/wevm/zyzz/pull/24) and [PR #27](https://github.com/wevm/zyzz/pull/27) merged configuration core and source contracts. Standard declaration values are the current follow-up.

The [historical CSS capability union](parity.md) records the 2026-09-08 API comparison across referenced frameworks. Its implementation labels describe that audit; this plan and Compatibility describe current support. Current declaration mapping and the independent property gate cover all 670 pinned properties. Historical batch counts below describe their original checkpoints.

### Build Infrastructure Follow-Up

[PR #17](https://github.com/wevm/zyzz/pull/17) introduces incremental theme analysis and the host-supplied import boundary with a Vite 8 integration. Keep source analysis static and independent of build tools; use established host infrastructure before expanding module resolution.

- [x] Accept resolved import identities from hosts and include them in analysis invalidation. Preserve the closed relative-graph compatibility path for standalone callers.
- [x] Add named `zyzz()` from `zyzz/vite`, using the existing Vite resolver, environment module graph, watcher, and CSS pipeline. Cover aliases, production CSS, real HMR notifications, deletions, missing-file creation, and browser theme updates.
- [x] Add Lightning CSS to standalone build processing with explicit targets and composed source maps. Preserve the consuming bundler's ownership of final CSS processing.
- [x] Delegate dynamic imports to Vite. Compile lazy physical modules independently; verify CSS splitting, development loading, SSR, and lazy theme HMR. Standalone graphs retain static-import diagnostics.
- [ ] Extend host integration to virtual/framework sources, library contracts, and Next.js using native host facilities. Do not add a general package resolver or watcher to the styling compiler.

### PR Sequence

1. **2.1 — In-Memory Theme Contracts:** `Theme.define`, compatible `Theme.extend`, immutable typed scalar references, and `Style.define` to `Css.compile` integration. Emit live custom properties, defining fallbacks, light/dark pairs, and complete inherited scopes. Cover browser scheme/scope behavior and compiler size/timing separately. Retain the documented literal grammar; source themes and authoring callables are not part of this PR.
2. **2.2a — Theme Authoring Contracts:** bound `theme.css` inference and missing-transform behavior; typed shorthand resolution through `Style.define(styles, { theme })`; property-specific color precedence, nested/numeric names, literal precedence, browser scope parity, and resolution-to-CSS benchmarks. Source rewriting is a separate dependency and bound calls remain non-executable until it lands.
3. **2.2b — Theme Source Identity and Linking:** extract bound calls, derive stable package/module/binding identities, link imported theme dependencies, and publish packed-library contracts. Expose compiled `theme.className`, preserve aliases/re-exports, and verify source/file/watch parity. No independently emitted theme library is supported before this gate.

   This work is split into two implementation PRs. **2.2b.1 — Local Theme Source** compiles literal local definitions/extensions, bound calls, and scope reads with stable identities, maps, source-to-browser coverage, and host rebuilds. **2.2b.2 — Theme Graph Linking** adds imported/exported contracts, aliases/destructuring/re-exports, explicit source token references, dependency watching, and packed-library interoperability. Local source support does not complete the linking gate.

   Follow theme source identity/linking with **2.2c — Configuration Contracts:** `Config.create`, inline/reusable theme inputs, named defaults and shared contract normalization, bound inference, source extraction, and packed declarations. Split this into **2.2c.1 — Core and Type Contracts** (PR #24: pure factory, named normalization, strict mode/token validation, and layer-key inference) and **2.2c.2 — Source Integration** (PR #27: named instance member access, aliases/re-exports, source edits, and packed declarations). Layer emission/hoisting remains 2.4c and variants follow Phase 3.

4. **2.3 — Standard Values and Variables:** start with **2.3a — Declaration Fallbacks and Importance** (#28), including the [versioned capability inventory](capabilities.md). **2.3b — Standard Length Units** ([#29](https://github.com/wevm/zyzz/pull/29), merged) expands absolute, font, viewport, and container length values through the existing source/token/fallback pipeline. **2.3c — Logical Boxes** ([#33](https://github.com/wevm/zyzz/pull/33), merged) adds logical dimensions/spacing, physical and logical inset offsets, writing modes, and conflict-safe CSS sharing. **2.3d — Flex Layout and Overflow** ([#35](https://github.com/wevm/zyzz/pull/35), merged) adds flex basis, integer order, item/line alignment, and overflow axes with preserved shorthand precedence. **2.3e — Borders and Outlines** ([#37](https://github.com/wevm/zyzz/pull/37), merged) adds physical/logical border sides and corners, outlines, and expanded color/radius token domains with conflict-safe sharing. **2.3f — Intrinsic Sizing** ([#38](https://github.com/wevm/zyzz/pull/38), merged) adds content-based dimension keywords, auto minimums, unbounded maximums, and flex content sizing while preserving token precedence. **2.3g — Scroll Spacing and Behavior** ([#41](https://github.com/wevm/zyzz/pull/41), merged) adds physical/logical scroll margins and padding, scroll behavior, and physical overscroll axes with source/map/browser coverage and conflict-safe sharing. **2.3h — Scroll Snapping** ([#42](https://github.com/wevm/zyzz/pull/42), merged) adds snap axes/strictness, one/two-keyword alignment, and stop behavior with source/map/browser coverage and transform benchmarks. **2.3i — Text Flow and Spacing** ([#43](https://github.com/wevm/zyzz/pull/43), merged) adds bounded wrapping/hyphenation, letter/word spacing, indentation, alignment, transformation, and text overflow with source/map/browser fixtures and transform benchmarks. **2.3j — Text Decorations** ([#44](https://github.com/wevm/zyzz/pull/44), merged) adds line combinations, shared color tokens, decoration styles, thickness, underline offsets, and ink skipping with source/map/browser fixtures and transform benchmarks. **2.3k — Tables** ([#46](https://github.com/wevm/zyzz/pull/46), merged) adds border collapse, scalar border spacing, caption placement, empty-cell visibility, and table layout through shared validation, source maps, browser comparisons, and transform benchmarks. Paired border spacing and length-only token domains remain deferred. **2.3l — Interaction Properties** adds cursor keywords, HTML pointer targeting, physical/logical resize axes, text selection, and visibility through shared types/validation, source maps, browser fixtures, and transform benchmarks. Cursor images, SVG pointer targeting, and selection containment remain deferred. Broader property families, functional values, static expressions, and inferred `theme.vars` follow; dynamic value bindings and explicit variables remain separate follow-ups.
5. **2.4a — Bundled Themes and Queries:** opt-in default tokens and typography, typed media/container thresholds, containment, and named query identity.
6. **2.4b — Selectors and Conditions:** pseudos/elements, data/ARIA states, the accepted typed marker/ancestor API and group/peer/descendant relations, nesting, media/supports/container conditions, and `@starting-style`. Specify helper specificity separately from raw selectors and retain browser behavior.
7. **2.4c — Stylesheet Contributions:** config layer lists, standalone `layers`, and module-level `global` with project-wide collection and hoisting; keyframes, font faces, and opt-in reset. Implement typed layer placement, source identity, ordering constraints, shared initial CSS, and browser/packaging gates. Variants remain Phase 3.

Local 2.3b evidence: 73 integration scenarios, consumer types, lint, and build pass. Browser fixtures passed in [CI](https://github.com/wevm/zyzz/actions/runs/34302945440); the subsequent type-check memory fix removes a duplicate fallback-value intersection in Config validation. Sequential 100-style transforms measured 3.7414 ms ±5.67% before and 3.9117 ms ±5.79% after (+4.6%, within reported uncertainty); CSS/JS/maps are byte-identical. New length workloads measured 0.8828 ms (10 additional styles) and 5.0719 ms (100). Machine-readable reports remain under `bench/results/length-*.json`.

Local 2.3c evidence: 93 integration scenarios, consumer types, lint, and build pass. Sequential 100-style transforms measured 3.8303 ms ±6.94% before and 3.8140 ms ±5.49% after; a repeated baseline measured 3.8490 ms ±5.85%. CSS, JavaScript, and map sizes are identical. Browser fixtures run in CI. Logical-box timing and delivery reports are saved under `bench/results/logical-*.json` and `bench/results/transform/logical-*.json`.

Local 2.3d evidence: 96 integration scenarios, consumer types, lint, and build pass. Sequential 100-style transforms measured 4.0932 ms ±6.55% before and 4.3677 ms ±7.62% after (+6.7%, within reported variability). CSS, JavaScript, and map sizes are identical. Flex-layout lanes measured 1.1914 ms (10 additional styles) and 6.6474 ms (100). Browser fixtures run in CI; machine-readable timings and delivery remain under `bench/results/flex-*.json` and `bench/results/transform/flex-*.json`.

Local 2.3e evidence: 98 integration scenarios, consumer types, lint, and build pass. Sequential 100-style transforms measured 3.9984 ms ±6.23% before and 4.2069 ms ±6.28% after (+5.2%, within reported variability), with identical CSS/JavaScript/map sizes. Border lanes measured 1.1377 ms (10 additional styles) and 5.9478 ms (100). Browser fixtures run in CI. Timing and delivery reports remain under `bench/results/border-*.json` and `bench/results/transform/borders-*.json`.

Local 2.3f evidence: 100 integration scenarios, consumer types, lint, and build pass. An initial 100-style sample measured 3.9795 → 4.5156 ms; keyword lookup now follows ordinary length validation. Sequential repeated baseline/candidate runs measured 3.7627 ms ±5.53% and 3.7078 ms ±4.67%, with identical CSS/JavaScript/map sizes. Intrinsic lanes measured 1.1521/5.9690 ms for 10/100 additional styles. Browser fixtures run in CI; reports remain under `bench/results/sizing-*.json`.

Local 2.3g evidence: 103 integration scenarios, consumer types, lint, and build pass. Sequential 100-style transforms measured 4.1592 ms ±10.88% before and 3.8474 ms ±5.72% after, with identical CSS/JavaScript/map sizes; variability does not establish a speed improvement. Scroll lanes measured 1.2791/5.9393 ms for 10/100 additional styles. Browser fixtures run in CI; reports remain under `bench/results/scroll-*.json`.

Local 2.3h evidence: 106 integration scenarios, consumer types, lint, and build pass. Sequential 100-style transforms measured 4.0228 ms ±5.81% before and 4.0030 ms ±5.65% after, with identical CSS/JavaScript/map sizes. Final snap lanes measured 1.3010/7.1405 ms for 10/100 additional styles. Browser fixtures run in CI; reports remain under `bench/results/snap-*.json`.

Local 2.3i evidence: 108 integration scenarios, consumer types, lint, and build pass. Sequential 100-style transforms measured 3.8911 ms ±6.01% before and 3.7739 ms ±5.58% after, with identical CSS/JavaScript/map sizes. Text lanes measured 1.2082/6.5039 ms for 10/100 additional styles. Browser fixtures run in CI; reports remain under `bench/results/text-*.json`.

CSS conformance follow-up: retain Zyzz-owned mappings, with pinned MDN/CSS Tree development tooling. A reviewed upstream inventory and weekly update PRs catch property/feature additions and grammar changes. Compiler and consumer-type probes validate the supported subset independently; native browser fixtures remain the rendering gate. See [conformance workflow](../test/conformance/README.md).

Local 2.3j evidence: 110 selected integration scenarios, consumer types, lint, and build pass. Sequential 100-style transforms measured 4.0875 ms ±5.88% before and 3.9494 ms ±5.85% after, with identical CSS/JavaScript/map sizes; overlapping uncertainty does not establish a speed improvement. Decoration lanes measured 1.2961 ms ±5.40% / 7.2680 ms ±12.88% for 10/100 additional styles. Browser fixtures run in CI; reports remain under `bench/results/decoration-*.json`.

Local 2.3k evidence: 101 selected integration scenarios, consumer types, lint, and build pass. Existing CSS/JavaScript/map sizes are identical. Initial baseline/candidate transforms measured 3.9532 ms ±6.96% / 4.4482 ms ±7.81%; sequential repeats measured 4.1700 ms ±8.83% / 3.8305 ms ±6.35%, without a consistent timing change. Table lanes measured 1.1591/6.4000 ms for 10/100 additional styles. Chromium is unavailable locally; browser verification runs in CI. Reports remain under `bench/results/table-*.json`.

Local 2.3l evidence: 103 selected integration scenarios, consumer types, lint, and build pass. Existing CSS/JavaScript/map sizes are identical. The baseline measured 4.2266 ms ±6.77%; candidate samples measured 4.5261 ms ±7.42% and 3.9589 ms ±6.34%, with no consistent regression. Interaction lanes measured 1.2100/9.1061 ms for 10/100 additional styles. Chromium download timed out locally; browser verification runs in CI. Reports remain under `bench/results/interaction-*.json`.

PR 2.1 uses opaque object references for contracts within one in-memory graph. Compiler-local token slots do not depend on values or theme-map labels. Separate source graphs and persistent identities remain PR 2.2b; do not publish these graph-local artifacts as independently composable theme libraries.

- [x] Create a versioned CSS capability inventory before broadening the literal subset. Track property/value, selector, at-rule, type/extraction/emission/map support, browser targets, native disposition, integration proof, and benchmark separately. Never equate accepted strings or types with supported rendering.
- [ ] Keep the numbered capability union and usage snippets synchronized as features land. Map 01–07 to source/value/theme work, 08–09 to recipes, 10–14 to selectors/queries/animation, 15–16 to contributions, 17–19 to renderer/library/external contracts, 20–22 to the explicit backlog, and 23 to native. Items span phases where stated; external-CSS examples do not satisfy typed API gates.
- [ ] Include Panda in the same union. Cover 24 multipart component styling through separate element definitions and the accepted marker API, 25 semantic token dependency/conditional-token design after source identity, and 26 responsive recipe selections alongside recipe composition. Keep each recipe's output a single props object.
- [x] Expand standard property families in 2.3: layout/positioning (including columns, containment, and overflow), grid/flex, logical dimensions/spacing, typography, backgrounds/gradients, borders/outlines, shadows, transforms, filters/masks, tables, scrolling, interactivity, SVG, and accessibility. Define shorthand/longhand and logical/physical interactions as each family lands.
- [x] Compile registered custom-property descriptors with matching syntax, inheritance and independent initial values. Browser fixtures verify defaults, inheritance and assignments; ordered declaration fallbacks retain their separate semantics. Expanded interpolation/target coverage remains a later acceptance workload.
- [ ] Expand token groups alongside their validated properties: scalar typography, composite typography, query thresholds, then border, shadow, opacity, transition, and stacking scales. Keep inherited theme selection separate from CSS color-scheme selection.
- [x] Implement the `Theme.define` and `Theme.extend` contracts before widening authoring syntax.
- [x] Implement the pure `Config.create` factory and inferred `css`/layer contracts with inline or reusable themes, complete named alternatives, explicit defaults, and isolated normalization. Source extraction and web variable references are implemented; `variants` remains Phase 3.
- [x] Compile named configuration instances through the source graph: direct bound calls, static theme members, immutable aliases/re-exports, config edits, and versioned packed declarations. Retain token/layer inference. Layer bodies and web variable references are implemented; variants remain Phase 3.
- [x] Expose the pure root `Config.create`, named/destructured `css`, `theme`, and `themes` exports, inline/reusable/named inputs, defaults, and exact layer lists. Bound variants remain in Phase 3.
- [x] Preserve destructured `css`, `theme`, and `themes` inference through aliases, re-exports, edits, packed metadata, and web variable references. Variant extraction remains Phase 3.
- [x] Expose named-theme selection as `themes({ theme: 'mint', colorScheme: 'dark' })`, inferring the required theme name from catalog keys. Keep default token references on `theme`, permit typed runtime selection, and verify nested scopes without property-access selection. Callable selection is implemented alongside destructured `css` and `theme` exports.
- [x] Validate named themes against the default's complete paths/domains, normalize shared config identities without mutating standalone themes, and retain default fallbacks. Cover missing/extra tokens, incompatible domains, partial extensions, imported definitions, aliases, source edits, and packed contracts with integration/type fixtures.
- [x] Verify web configuration-to-browser theme selection, stable component classes, nested scopes, forced schemes, and packed handles through the theme-selection browser fixtures. System-scheme and omitted-scheme inheritance at the callable selection boundary, native table selection, and expanded switch-timing workloads remain separate gates.

- [ ] Add `zyzz/themes/default` with named `css`, `theme`, and raw `tokens` exports; add bound `variants` when recipe compilation lands in Phase 3. Bundle colors, typography, spacing, radii, and related scales using the ordinary theme contract; keep light/dark values within the theme.
- [ ] Preserve inference and extraction for bundled `css` aliases and re-exports. Verify parity with `theme.css`, explicit token composition, and use of the exported theme with target compilers. Apply the same alias contract to `variants` in Phase 3.
- [x] Accept token groups directly with no metadata or scheme container. Each color leaf is `string | { light: string; dark: string }`; require both fields for pairs.
- [x] Infer `theme.css` arguments from shared `color` and property-specific `backgroundColor`, `textColor`, and `borderColor` groups, with documented fallback and override rules. Reject wrong domains, unknown tokens, partial pairs, and incompatible extensions.
- [x] Derive internal theme identities without caller metadata; extensions retain base token identities independently of values. Switching theme scopes must not require recompiling component classes.
- [x] Make bound styles work without a root scope using custom-property fallbacks; expose `theme.className` for inherited overrides and retain token-free `css` from the root entrypoint.
- [x] Expand standard length units with a shared type/runtime vocabulary, source maps, token/fallback/importance integration, browser fixtures, and a full-transform benchmark lane. Containment declarations, expressions, and native conversion remain separate gates.
- [x] Implement web declaration importance and ordered fallbacks across typed authoring, source extraction, CSS emission, and per-entry maps. Cover browser priority, token references, scalar validation, and fallback benchmarks. Native diagnostics remain gated on the native adapter.
- [x] Implement web importance suffixes and ordered nonempty fallbacks, including quoting, templates, numeric values, tokens, mixed importance, and invalid-array diagnostics. Native rejection remains with its adapter.
- [x] Accept ordinary strings and untagged template literals for CSS expressions. Fold static primitive interpolations and preserve recognized variable references; reject unknown object coercions, unresolved runtime values, and arbitrary function calls. Cover equivalent literal/template output, source diagnostics, variable liveness, and target validation.
- [x] Expose typed web `theme.vars` scalar references with defining fallbacks, shared identities, template interpolation, and liveness. Query/composite groups remain excluded; native bindings remain deferred.
- [x] Verify `theme.vars` inference, unknown paths, incompatible domains, absence of implicit root theme data, custom themes, inherited overrides, light/dark fallbacks, variable liveness, and removal of authoring callbacks from generated modules.
- [ ] Verify bundled `theme.vars` through the public default-theme entrypoint when it is published.
- [x] Define numeric token/literal behavior, keyword precedence, ordered fallbacks, expression references, and explicit token references and CSS literals. Verify that root calls accept standard lengths, unitless values, and CSS zero while rejecting undeclared named/numeric tokens, even when a theme is imported elsewhere.
- [ ] Implement optional branded `ClassName<Properties>` types across exports, conditions, and shorthand expansion.
- [x] Implement typed `Vars.define`/`Vars.set` web bindings with fixed custom-property identities and imported/re-exported packed contracts. Native bindings remain deferred.
- [x] Implement dynamic `css((values: Values) => style)` with an explicitly typed values record and callable web props output. Object definitions are also callable. Accept runtime values and styling overrides in one input, consume the full declared finite key set, reserve merge keys, and reject unknown inputs instead of forwarding props. Share binding slots with `Vars` and publish callable declarations across packed libraries.
- [x] Extract dynamic scalar positions without executing callbacks. Emit fixed CSS-variable rules and small binding functions; reject dynamic rule structure, token lookup, optional/null leaves, arbitrary calls, and unsupported expressions. Specify primitive validation, private variable isolation, static fallback restrictions, and explicit binding composition.
- [ ] Add real source-to-browser integration scenarios for callback values, pseudo/query rules, nested instances, theme changes, server rendering/hydration, and packed callable exports. Prove stable classes/rule count after repeated updates and removal of authoring callbacks. Check input inference, callable static/dynamic props, consumed-key removal, override rules, reserved keys, and rejected className misuse through consumer fixtures and benchmark binding time, CSS/JavaScript bytes, and browser recalculation.
- [x] Recognize local member aliases, css destructuring/renaming, and alias chains with inference, lexical shadowing, generated type contracts, and source/file/browser integration.
- [x] Compile explicit local theme token paths in bound calls/aliases, preserving token domains, fallbacks, liveness, source locations, and numeric/nested paths.
- [x] Link relative source theme imports/exports, bound-authoring functions, named/star re-exports, and compatible extensions through Graph.compile. Preserve defining identities and cross-file maps; rebuild file-host consumers on dependency edits and recover from missing modules.
- [x] Add an owned incremental graph compiler and use it in the file host. Reuse unchanged extractions/transforms, invalidate transitive importers, re-emit all scopes after theme changes, and recheck resolution after file-set changes. Failed compilations preserve the last successful snapshot.
- [x] Add versioned packed authoring contracts and host sidecars. Resolve package exports through Vite, retain aliases/re-exports and declarations, and compile consumers from metadata without executing libraries. Cyclic source graphs still produce explicit diagnostics; dynamic imports remain host-owned.
- [x] Confirm the packed-library browser fixture and CI in PR #23. Independently built library/app styles, nested scopes, schemes, and stable component classes pass with explicit native light-dark targets. Merge remains pending.
- [x] Implement local literal theme factories/extensions, direct bound calls, and scope reads through Source/Transform. Keep theme identities stable across value edits and unrelated source insertions; retain generated TypeScript contracts without shipping theme authoring code. See [local theme compilation](../docs/guides/themes.md#compile-local-theme-source).
- [x] Support static `css` calls inline, outside markup, and in exported/imported style constants equally; extraction must not depend on a `className` attribute.
- [x] Implement scoped pseudo-classes/elements, explicit `&` selectors, and nested `@media`, `@container`, and `@supports` with theme inference at every depth.
- [ ] Add relational-selector integration/type fixtures for named data groups/peers, group descendants using `:has`, sibling direction, direct/all children, nested names, state combinations, and cross-module reusable conditions. Preserve explicit `:where`/`:is` specificity; do not infer nearest-group boundaries.
- [x] Implement the accepted `Css.marker(schema?)`, `Css.ancestor(marker, condition?)`, and the matching descendant/sibling helpers from architecture. Infer finite state keys/values from the marker alone, autocomplete simple pseudos, and validate relative `has` selectors. Generated private data attributes retain source/package identity, avoid recipe collisions, and never require runtime DOM lookup or CSS generation.
- [x] Verify marker state-name lowering rejects ASCII-case-fold collisions (`state`/`State`) and applies the same lowercase fragments in HTML attributes and selectors; typed selections remain case-sensitive.
- [x] Preserve property/value/theme inference in relationship blocks; reject invalid finite states, known arbitrary symbol keys, pseudo typos, and invalid `has` combinations. Source extraction rejects unresolved computed keys. TypeScript erases branded computed-symbol keys to symbol indices; those indices require source verification.
- [ ] Validate helper zero-specificity lowering separately from raw selector semantics. Exercise real browser ancestor/descendant/peer behavior, combined states, multiple/repeated/nested markers, hydration and stale attribute removal. Include complete CSS/JavaScript/data-attribute delivery and matched relational workloads in benchmarks; unsupported native relationships must error.
- [ ] Cover structural/form/interactive pseudos, data/ARIA/direction/open states, pseudo-elements with explicit content, and accessibility/device/print/feature conditions. Keep raw hover semantics distinct from hover-capability queries; validate `@starting-style` ordering and discrete-transition behavior.
- [x] Add `breakpoints` and `containers` groups with inferred `@media <name>` and `@container <name>` aliases that expand into inclusive minimum-width conditions.
- [x] Extend query inference with `>=`, `<`, inclusive/exclusive ranges, and `containerNames` for named queries and declarations.
- [x] Reject unknown/cross-group aliases, reserved-name collisions, and invalid threshold lengths without weakening property checking or raw CSS condition support.
- [x] Resolve query thresholds statically; specify extension overrides, dependent recompilation, and unchanged thresholds when switching runtime theme scopes.
- [ ] Document nearest eligible container selection, explicit containment, named raw queries, and stylesheet-level rule boundaries. Implement stylesheet contributions through `fontFace`, `global`, `keyframes`, and `layers`, with optional reset and authored layer placement.
- [x] Compile direct named `fontFace`, `global`, and `keyframes` imports and aliases. Preserve exported animation identities and packed stylesheet effects through real Vite/library builds, with source-map and asset publication regressions.
- [ ] Define keyframe offsets, comma-separated stops, declaration-only frame bodies, importance rejection, stable imported references, theme variables, conditional reachability, and animation shorthand/list parsing. Test sampled animation progress and reduced motion in a real browser; measure reused/distinct animations and emitted CSS/JavaScript size.
- [ ] Specify scoped/global contribution identity and explicit in-memory ownership, multi-source fonts and URLs, layer nesting/order/importance, and tree-shaking side effects. Global external names and contract-only theme interoperability require a documented decision before claiming parity.
- [x] Compile exact config-bound layer keys, standalone layer/global contributions, and unlayered rules. Preserve nested token inference, aliases and packed types without ambiently widening config layers. Variant layer bodies remain Phase 3.
- [x] Collect static declarations across configured project roots, including unimported modules; exclude tests, generated output, and dependencies by default. Keep dependency inclusion explicit. Reject runtime placement without executing application code. Preserve globals through JavaScript tree shaking, including unused exports and `sideEffects: false`, and document their eager application-wide effect beside lazy components.
- [ ] Merge layer order constraints with stable topological ordering and canonical-name tie breaking; report contradictory cycles at their sources. Emit one initial order prelude, preserve dotted hierarchy and authored rule order, and define stable cross-module ordering independently of traversal or chunk completion. Verify normal/unlayered precedence, important reversal, repeated authored rules, and external stylesheet load-order limits in a real browser.
- [x] Share source-owned contribution sections across compiler and adapters; deduplicate imports, preserve per-call maps, relocate assets before hoisting, and track additions/deletions and updates through real graph, host, and Vite fixtures.
- [ ] Publish CSS plus layer/contribution metadata for libraries, with namespaced public layers and application-owned top-level ordering. Verify packed-library and plain-CSS consumption, metadata conflicts, shared initial stylesheet ownership, and explicit native rejection. Benchmark project-wide discovery, incremental collection, ordering, and full CSS/JS/metadata delivery against matched existing-library workloads where equivalent.

- [x] Emit scoped custom properties and `light-dark()` values. Support `color-scheme: light`, `dark`, and `light dark`, independently of theme identity.
- [x] Specify nested scope inheritance, complete overrides, independently forced schemes, deterministic server output, and undeclared-theme failures.
- [ ] Implement callable theme handles retaining metadata and `.className`; return generated scope props with optional `colorScheme`. Cover root `<html>`, nested scopes, no-option inheritance, rejected options, aliases/imports, packed handles, dynamic catalog selection, and compiler/type/browser parity.
- [x] Implement bound `script({ storageKey }?)` on every `Config.create` result for localStorage-only root initialization. Derive catalog/default/compiled classes through imported and packed config bindings without serializing token data; cover named, single-theme, and token-free configs; preserve server defaults and unrelated root attributes. No cookies, providers, implicit persistence, or preference listeners.
- [x] Verify synchronous root restoration, invalid/blocked storage, HTML-safe serialization, CSP execution, and hydration node identity through `ConfigScript.test.ts` in Chromium.
- [x] Preserve standard declaration order, selectors, at-rules, inheritance, and cascade semantics. Specify token/literal precedence and retain authored condition order.
- [x] Support same-module immutable definitions and spreads through static binding analysis.
- [ ] Add imported static definitions with explicit resolution and cycle errors.

Gate: two compatible themes each work in both schemes. Switching a scope changes colors and shared tokens through CSS alone. Nested themes and explicit schemes behave as specified. Inline and exported styles retain inference. Dynamic callbacks bind typed values to fixed rules with stable classes, and static definitions remain callable with optional styling overrides; browser integration and binding benchmarks verify both. Nested selectors and raw/aliased queries preserve CSS semantics; invalid definitions fail without evaluating application code.

### Property Mappings and Token Groups

- [x] Implement [config shorthands](architecture.md#property-mappings) after standard box properties: static one-to-many mappings such as `px`, `paddingX`, and `paddingHorizontal`; preserve declaration order, importance, fallbacks, and expanded conflict domains.
- [x] Add optional `margin` and `padding` token groups with property-specific precedence over `spacing`, signed-margin/nonnegative-padding validation, and physical/logical coverage. Retain existing `textColor` precedence over `color`.
- [x] Preserve mappings through bound css/theme handles, nested declarations, source graphs, packed metadata, and config watch edits; extend the same boundary to variants and native as those capabilities land.
- [x] Verify exact alias/value inference, target intersections, collisions/chains/unknown targets, references, extensions and packed metadata consistency. Browser fixtures compare ordered mapped declarations and importance.
- [ ] Add dedicated property-mapping benchmark lanes recording compilation and emitted sizes.

### Full At-Rule Support

Implementation is stacked in [#95](https://github.com/wevm/zyzz/pull/95), [#96](https://github.com/wevm/zyzz/pull/96), [#97](https://github.com/wevm/zyzz/pull/97), [#99](https://github.com/wevm/zyzz/pull/99), and [#100](https://github.com/wevm/zyzz/pull/100), followed by the acceptance PR. Direct helper APIs, portable references, namespace isolation, ordered statements, and native scalar CSS functions are implemented. Acceptance adds direct/packed source-map ownership, nested asset watch updates, real-font/counter/anchor/browser controls, and declaration benchmarks.

The inventory accounts for 22 rules and 61 descriptors/nested blocks. Implemented entries remain conservatively partial while complete context/grammar and browser evidence is reviewed.

Composite CSS function `type(...)` signatures, color-profile rendering, and full paged-output behavior remain explicit acceptance gaps. Do not claim 100% at-rule support or enable the full-completion gate prematurely. Browser availability reports distinguish native experimental/legacy support from source emission.

Accepted direction: [top-level stylesheet functions](../docs/api/web/at-rules.md), alongside native grouping keys in `css`/`variants`. Descriptor and statement rules do not become properties under `global`. This is Phase 2 standard-authoring follow-up after the existing framework/stylesheet/variable stack; current PR acceptance remains separate.

- [ ] **2.5a — Inventory and Context Contracts:** pin the full MDN at-rule/descriptor inventory, including nested page/font rules and alternate forms. Set a 100% inventory-accounting gate immediately; keep implementation coverage separate and require 100% before claiming full support. Finalize ordered conditional/layered helper contexts, external names, query/profile references, and CSS-function signatures.
- [ ] **2.5b — Nested Rules and Existing Helpers:** complete `@scope`, all media/supports/container forms including scroll-state queries, legal starting-style/layer contexts, all font-face descriptors, and named timeline-range keyframe stops. Preserve variant/compound inference and CSS nesting semantics.
- [ ] **2.5c — Named Declarations:** add direct `counterStyle`, `positionTry`, `fontPaletteValues`, and `colorProfile` functions. Preserve domain-specific references through imports, aliases, re-exports, lists/shorthands, packed contracts, and rebuilds. Reuse variable registration from `Vars.define` without duplicating its API.
- [x] **2.5d — Document Declarations:** add `page`, all page-margin boxes, `fontFeatureValues` and its nested blocks, and `viewTransition`. Cover repeated calls, conditional/layered placement, eagerness, and CSS order.
- [ ] **2.5e — Statements and CSS Functions:** add `importCss`, `namespace`, `customMedia`, and `cssFunction`; implement the output charset policy and explicit legacy `@document` support. Preserve namespace boundaries, relative URLs, import ordering/conditions, and CSS function parameter/result domains.
- [ ] **2.5f — Full Acceptance:** require every rule, descriptor, nested form, and supported context to have type/extraction/emission/map evidence, packed-library and watch coverage, and applicable real-browser fixtures. Record experimental/legacy browser availability separately. Add source-owned diagnostics for unsupported native semantics and benchmark compiler/output changes. No runtime authoring validation.

The existing property-conformance percentage does not measure at-rules. Extend the conformance workflow with reviewed upstream grammar fingerprints and per-rule evidence; new upstream entries and regressions must fail inventory checks. Do not mark missing implementations supported through generic string acceptance or raw passthrough.

## Phase 3 — Composition, variants, and target output

- [ ] Keep `variants` scoped to one element, returning one props object with no `slots` option. Cover multipart components through separate `css`/`variants` definitions and shared component inputs; use data attributes or typed markers for supported DOM relationships.
- [ ] Specify responsive recipe selection separately from dynamic payload choices, including conditions/defaults/nulls/compounds and native diagnostics. A static choice containing media rules does not establish full conditional-selection parity.
- [ ] Preserve every finite runtime-selectable recipe alternative across source extraction, aliases, and packed libraries before pruning unused choices. Verify CSS/JS/attribute delivery and matched component/conditional workloads against the existing benchmark set, including Panda.

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

Status: planned. Renderer output and Solid, Vue, Svelte, and Next.js source/consumer verification now belong to the Phase 2 [Framework Integration Priority](#framework-integration-priority). The remaining distribution and native gates stay here.

- [ ] Verify plain document, component, template, and native consumers through their normal class/style APIs.
- [ ] Build the CLI with `build [src]` and `watch [src]` commands (defaults: `src`, `dist`, `<out-dir>/styles.css`) and optional `--out-dir`, `--css`, and `--minify` flags; rewrite modules alongside CSS and declarations, requiring no styling plugin in consumers.
- [ ] Verify zero-argument `build`/`watch` defaults, initial watch compilation, explicit path overrides, missing-source errors, and CSS defaults following `--out-dir`.
- [ ] Verify CLI/build/in-memory parity, dependency watching, output exclusion, diagnostics, failure preservation, and owned-output cleanup. Include imported style constants and threshold edits in dependency recovery fixtures.
- [ ] Keep build integrations optional and thin; implement only those needed by concrete fixtures.
- [ ] Validate the [Getting Started](../docs/introduction/getting-started.md) Vite and CLI paths as real consumer fixtures. Finalize the proposed `zyzz()` entrypoint, automatic dev/production CSS delivery, and standalone CLI output consumption without generated-component imports in application examples. Cover edits, production rendering, and matching CSS; remove preview callouts only when the complete paths work.
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

Build each remaining capability and its acceptance fixtures before marking its phase complete. Phase 1 is complete; Phase 2 is being delivered in the PR sequence above.

## Benchmark Expansion

Performance target: Zyzz leads every applicable workload against every enabled compiler in build time and combined CSS/required-JavaScript transfer (raw, gzip, and Brotli). Report individual CSS and JavaScript measurements as well. A feature or optimization phase is not performance-complete while known losses remain. Confirm timing advantages in repeated, sequential, matched runs; a noisy single-run ranking is insufficient.

Baseline size gaps, measured after shared Lightning CSS processing in [benchmark run 34145064696](https://github.com/wevm/zyzz/actions/runs/34145064696): reused palette totals 1,165 gzip bytes against Tailwind's 1,039; mixed components total 1,038 against vanilla-extract's 919. Build time leads all eight current workloads. Independent composition now closes these gaps by deduplicating complete applications, without changing the default ordered emitter. The component matrix explicitly measures independent applications and gates all eight workloads; arbitrary raw class composition remains a distinct contract and is browser-tested in ordered mode.

- [x] Close the palette and mixed-component transfer gaps for independent applications while retaining readable class names and the default ordered mode's shorthand/longhand behavior and A/B/A override order. Verify all eight workloads after each candidate, including raw/gzip/Brotli regressions outside the target case.
- [ ] Evaluate composition-aware declaration sharing with real generated props and conflict metadata as those APIs land. Do not merge repeated conflicting rules in the current ordered emitter or compare reduced-semantics output as a replacement for it.
- [x] Extend transfer regression gates to every independent-component workload once matched results establish the target. Keep all competitors and workloads visible while gaps remain; do not loosen existing gates or optimize benchmark-only serialization.

Status: eight literal workloads and five real compiler adapters are implemented on PR 1.2. Panda CSS joins the existing adapters. Tamagui has been removed from the PR matrix due to extraction cost; no additional styling libraries are authorized. Browser equivalence covers every workload. Existing size gates remain; discovery cases expose further optimization targets.

- [ ] PR 1.3–1.5: add cold-process source builds, warm builds, unchanged edits, new styles, removed styles, and imported-dependency edits. Include parsing, scanning, rewriting, and output writing explicitly. In-memory emission must remain a separate measurement.
- [ ] PR 1.5: add opt-in 10/100/1,000/10,000-style sweeps and independently vary rendered instance count. Keep expensive runs outside the short PR matrix.
- [x] Phase 2: add matched 10/100-component, two-scope theme compiler comparisons for Panda, StyleX, Tailwind, vanilla-extract, and Zyzz. Include complete delivery and real browser scope/scheme parity; keep differences in compiler boundaries explicit.
- [ ] Evaluate and close compressed-delivery gaps in the 10-component theme workload after browser parity with native light-dark targets. Keep the unchanged two-scope workload and report all sizes; matched CI results are authoritative.
- [ ] Phase 2: add complex themes, nested scopes, forced/system schemes, query density, and independent dynamic values. Measure rule growth, CSS-variable assignment, and style recalculation in real browsers.
- [ ] Phase 3: add default/compound variants, variant changes, consumed-value updates, unchanged parent rerenders, and override-heavy composition. Verify comparable cascade semantics before comparing shorthand and A/B/A composition across libraries.
- [ ] Phase 3–4: adapt deep/wide component trees and dynamic triangle workloads using real production framework runtimes. Separate mount, cached rerender, changed props, CSSOM writes, layout, paint, and interaction latency. Do not substitute raw DOM timing for framework runtime cost.
- [ ] Phase 4: add SSR throughput and full HTML/CSS/JavaScript delivery, hydration, route splitting, dead-style removal, and packed-library boundaries. Keep framework baseline and incremental styling cost visible without double-counting assets.
- [ ] PR 1.2 onward: optimize every workload against Panda CSS, StyleX, Tailwind, and vanilla-extract and promote measured cases to regression gates. Record all raw/gzip/Brotli results, including losses; do not change fixtures to manufacture wins.

The benchmark implementation and reproduction notes record prior-art attribution. Later workloads must use actual supported APIs, without mocks, replacement compilers, or placeholder zero results.

### Minification Follow-Through

- [ ] PR 1.4–1.5: preserve deterministic identifiers, source maps, efficient class references, and sensible safe grouping through source emission. Avoid benchmark-only module serialization optimizations.
- [ ] Phase 4: add configurable Browserslist `targets` to shared CLI/build options and a `--targets` CLI flag. Resolve at the adapter boundary; preserve modern CSS when omitted, inherit consuming-build targets where applicable, and keep compatibility transforms independent of minification. Include resolved targets in cache identities and processing diagnostics.
- [ ] Phase 4: validate downlevel color-scheme behavior with inherited, forced, inline, and external scopes; diagnose target combinations that cannot preserve semantics.
- [ ] Phase 4: add Lightning CSS at the CLI/build adapter boundary with explicit targets and source-map composition. Allow the consuming build to own final processing without a mandatory second pass; core compilation remains usable without minification.
- [ ] Phase 4: namespace independently emitted graphs and verify packed-library consumption through final CSS processing. Preserve class/reference alignment and readable development/production identities.
- [ ] After the shared baseline: improve simple code generation only where complete delivery measurements justify it. Keep CSS-only size, total size, compile time, and browser performance distinct.

### Deferred Optimizer Research

Custom conflict graphs, shared-subset/biclique search, bounded beam search, MaxSAT experiments, equality saturation, dictionary sharing, and compression-based candidate selection are not scheduled MVP work. Revisit only for a reproducible material gap after standard minification, with evidence that simpler code generation is insufficient and that added compile time and complexity are justified.

### Optimization Acceptance

- [ ] Target smaller complete delivery across the unchanged corpus while retaining existing gates and reporting every raw/gzip/Brotli result, including losses. No universal minimum or fastest-compiler claim follows from a single benchmark run.
- [ ] Verify supported CSS semantics through real browser integration tests before accepting size improvements. Keep core agnostic and minification in adapters or consuming builds.
- [ ] Confirm timing improvements across repeated matched runs and retain variance. Do not use noisy strict winner assertions or hide differing source-pipeline boundaries.

### Explicit CSS Backlog

- [ ] Specify semantic token aliases, dependency cycles, missing paths, property domains, imported identities, and override/inheritance behavior without changing token-only theme arguments. Keep conditional tokens separate from light/dark pairs and query metadata.
- [ ] Evaluate named typography/surface/motion presets, opt-in token-only enforcement, and token/recipe documentation export after core contracts. Retain ordinary static-object composition and CSS values as defaults; no general utility registry or generated application SDK is required.

- [ ] Complete the at-rule families under [Phase 2.5](#full-at-rule-support). Track related scoped view-transition names/classes and pseudo-elements, anchor declarations, scroll-driven timelines, and emerging property values separately; at-rule support does not complete those adjacent features.
- [ ] Keep browser API orchestration (DOM/CSSOM, Web Animations, preference/layout observers) outside the style compiler. Shared native authoring has its own capability matrix; a browser-only rule cannot silently disappear on native.

## Documentation Coverage

- [ ] Keep entrypoint/module/method reference coverage aligned with public exports and their types/errors. Preview APIs use note callouts and do not imply executable examples.
- [ ] Verify Getting Started through real CLI and bundler consumer fixtures before removing preview notes. Source imports and the named config helpers remain identical across supported integrations.
- [ ] Extend framework, SSR, migration, and native guides alongside integration proof; do not claim target compatibility from shared authoring types alone.

## Continuing CSS Conformance

Continue all property/value work in the single consolidated CSS conformance PR against the pinned MDN inventory. Each batch preserves independent grammar/type validation, adds browser fixtures and benchmark evidence, and records remaining restrictions. New type fixtures use describe/test blocks. Full support requires value and rendering proof, not property-name acceptance.

- Column properties: 12 additions plus normal column gaps; numeric keyword domains preserve positive count validation. Shorthands and remaining fragment grammar follow separately.

- Layout and containment: 10 additional properties and 13 display keywords, with finite containment, safe stacking integers, independent grammar/type checks, and float/stacking browser fixtures. Broad syntax remains partial in the inventory.

- Backgrounds and color controls: 14 additional scalar properties, color-token/auto disambiguation, independent grammar/type probes, and browser computed-style comparisons. Images, gradients, lists, and paired values remain deferred.

- SVG paint: 19 additional properties with shared color tokens, bounded scalar domains, source maps, independent grammar/type probes, and evenodd path geometry in Chromium. Broad paint syntax and filter rendering remain deferred.

- Font controls: 19 additional typography, emphasis, and ruby properties with bounded keyword combinations, independent grammar/type probes, and native text layout fixtures. Font-dependent glyph behavior and broader values remain deferred.

- Motion controls: 11 additional properties and a finite time dimension domain, independent grammar/type probes, invalid duration checks, source maps, and native paused-animation timing. Lists, easing functions, keyframes, and timelines remain deferred.

- Grid tracks: nine additional properties, bounded fr dimensions and grid-line domains, independent grammar/type probes, source maps, and implicit-track/span geometry. Structural track lists are implemented below; named-line placement and areas remain deferred.

- Masks and image positioning: 16 additional properties, scalar position domains, background axis conflict handling, independent grammar/type checks, source maps, and masked-pixel comparisons. Image sources, lists, and complex functions remain deferred.

- Lists and input controls: 13 additional properties, 94 finite touch-action forms, independent grammar/type probes, source maps, and native list-marker/tab comparisons. Custom counter styles and gesture behavior remain deferred.

- Color keywords: expands the existing color domains to all 148 canonical lowercase names and 19 system colors with independent exhaustive grammar/type probes and native scheme comparisons. Functional colors remain deferred.

## Container and Field Sizing

`containerType` accepts `normal`, `size`, `inline-size`, `scroll-state`, and either size mode combined with `scroll-state` in either order. `fieldSizing` accepts `content` or `fixed`; `interpolateSize` accepts `allow-keywords` or `numeric-only`. Fallbacks and importance use the shared literal pipeline. The inventory tracks 301 partially implemented properties; container names, query authoring, and interpolation functions remain deferred. Browser evidence covers native container-query responses and content-sized inputs; scroll-state queries and animated intrinsic-size interpolation remain separate gates.

## Reading Order

`readingFlow` accepts the seven modes from the pinned CSS Display grammar. `readingOrder` accepts signed safe integers, including zero, with ordered fallbacks and importance. Runtime validation rejects fractions and unsafe integers; TypeScript's number domain cannot express these numeric bounds. Chromium keyboard fixtures compare reversed visual flex flow and explicit ordinal groups with independent native controls and source-order navigation. The inventory now tracks 303 partially implemented properties. Grid traversal, writing-mode interactions, assistive-technology traversal, and cross-browser behavior remain separate gates. See [CSS Display Level 4](https://drafts.csswg.org/css-display-4/#reading-flow).

## Historical Property Conformance Record

> [!NOTE]
> Archived checkpoints from 2026-09-08 through 2026-09-11, retained in their original sequence. All counts, partial statuses, failing gates, and outstanding-work statements in this section describe those historical checkpoints. The current 670/670 state and acceptance evidence are recorded at the top of this plan.

Keep the remaining CSS property implementation in one PR. The required CI job fails unless all 670 pinned MDN properties are fully supported; partial entries never count toward 100%. Retain independent grammar checks, public type probes, emission checks, browser evidence, and performance gates. Do not promote inventory statuses to make CI green before the implementation and evidence exist.

Outstanding work includes the 248 deferred properties and completion of all 422 partial domains: CSS tokenization/escaping and case handling; compositional value grammars, lists, functions and custom identifiers; property-specific numeric rules; shorthand/longhand cascade interactions; and independent browser/type evidence. The threshold remains red while these gaps exist. The property gate does not claim full support for the separately tracked selectors and at-rule families.

### Structured Grid Tracks

Explicit and implicit grid tracks accept size lists, `minmax()` and `fit-content()`. Explicit tracks also accept line-name groups and integer or automatic `repeat()`, including fixed-size restrictions for auto-repeat. Repetitions remain compact CSS rather than being expanded by the compiler. The compiler rejects invalid argument counts, flexible minima, nested repetition, and multiple auto-repeat groups. Consumer types constrain the outer value shape; nested grammar is checked during compilation.

Independent MDN grammar probes and native responsive-grid fixtures cover these additions. Math functions, variable references, escaped identifiers, and subgrid name repetition remain incomplete; property completion stays partial.

### Box Value Lists

Margin, padding, inset, border-width, scroll-margin, and scroll-padding shorthands accept one to four space-separated scalar components. Their logical block/inline shorthands and gap accept pairs. Each component retains its property-specific auto, percentage, and sign rules; CSS-wide keywords must stand alone. Longhands remain scalar. Type shapes cover lists while the compiler validates arity and every component. Native browser fixtures compare physical longhands in horizontal and vertical writing modes, including importance and shorthand/longhand overrides. Functions, variable substitution, and broader component spellings remain incomplete.

### Motion, Color, Border, and Keyword Grammar

Motion lists preserve easing-function commas and validate cubic-bezier(), steps(), and linear() constraints. Absolute functional colors preserve color spaces and browser clamping. Border color/style lists and elliptical radii preserve logical overrides and importance. Compatible font variant and containment groups reject conflicts; font-synthesis adds one partially implemented property.

The completion count remains 0/670: 561 partial and 109 deferred (84 standard, 25 vendor-prefixed). Shared substitution, math, tokenization/escaping, relative colors, combined shorthands, and the remaining property families are still required. Browser fixtures verify motion output, themed colors and SVG, border expansion, and grouped declarations. The external alias consumer typecheck has a bounded ten-second subprocess timeout within a fifteen-second integration deadline; benchmark gates remain separate and unchanged.

### Dimensional Math

Number, length, time, and grid track domains accept literal calc(), min(), max(), and clamp(). Component splitting preserves nested function spaces and slash axes. The parser checks dimensional compatibility and arithmetic precedence; browser evaluation owns clamping, integer rounding, and unit resolution. Substitution, constants, dimension cancellation, and additional functions remain incomplete. Nesting is bounded at 128 levels.

### Deferred Variable Values

All mapped property types admit unquoted var() expressions. The web emitter validates and preserves raw references alongside typed theme tokens; browser substitution owns property-value matching, inherited custom properties, cycles, and invalid-at-computed-value semantics. Compiler validation requires balanced delimiters and valid unescaped custom-property names. Quotes, comments, braces, URL tokens, and more than 128 nested levels remain unsupported.

SVG geometry, baseline, caret, emoji, font-synthesis-position, logical overflow, scrolling axes, text wrapping, and additional scalar keywords add 38 partial property mappings. Positions allow signed lengths; radii retain nonnegative bounds. Animation composition and scroll timeline axes accept comma lists. Related shorthand and alias domains preserve A/B/A declaration order.

Zoom accepts nonnegative numbers/percentages and normal/reset. Stop opacity accepts finite numbers/percentages with browser clamping. Experimental properties may lack browser implementation; grammar and type coverage do not imply browser support. New SVG geometry and text fixtures compare native computed values and rendered bounds.

Text wrapping, underline position, hanging punctuation, flex flow, position visibility, masonry flow, and speech keywords validate compatible groups. Border/mask image repetition accepts pairs. Timeline axes accept comma lists; interest delays remain scalar. Further baseline, offset, column, fragmentation, and legacy mappings add 44 partial properties. Shorthand and alias domains preserve authored cascade order.

Independent grammar and generated consumer probes cover the expanded map. Browser controls exercise text and flex output; obsolete and experimental declarations retain separate browser limitations. Complete range rules, lexical forms, and associated functional/shorthand grammars remain incomplete.

Eighteen named-value properties add unescaped custom identifiers, dashed names, and comma/space lists. Names preserve case; validation excludes CSS-wide and property-reserved words, enforces standalone keywords, and rejects malformed prefixes or list boundaries. Public string types defer lexical validation to compilation. Quoted names, escaping, comments, and timeline functions remain incomplete.

Browser fixtures resolve case-sensitive keyframes and named container queries. Name grammar follows [CSS Values](https://www.w3.org/TR/css-values-4/#custom-idents), [Containment](https://www.w3.org/TR/css-contain-3/#container-name), [Transitions](https://www.w3.org/TR/css-transitions-1/#transition-property-property), and [Will Change](https://www.w3.org/TR/css-will-change/#will-change). These mappings retain partial status.

Combined border, physical/logical border sides, outline, and column-rule add thirteen partial properties. Values accept one width, style, and color in any order, preserving functional components. Duplicate domains, negative literal widths, and percentages are rejected. When a combined shorthand occurs, related declaration domains remain ordered to preserve longhand overrides.

Browser controls compare both text directions and three writing modes, A/B/A overrides, and the border-image reset performed by border. Independent grammar and consumer probes cover component permutations and functional values. Escaped spellings, broader color functions, and complete numeric forms remain incomplete.

Aspect ratios and transform/translate/rotate/scale add five partial properties. Transform functions validate arity and component dimensions while preserving authored order. Individual transforms accept their respective vector forms. Angle math extends calc/min/max/clamp dimensional checks; percentage depth translations and malformed matrices are rejected.

Browser fixtures compare individual transforms with equivalent function lists, native 3D matrices, rendered bounds, and aspect-ratio sizing. Constants, dimension cancellation, full escaping, and broader numeric spellings remain incomplete. See [CSS Transforms](https://www.w3.org/TR/css-transforms-2/) and [CSS Sizing](https://www.w3.org/TR/css-sizing-4/#aspect-ratio).

Theme authoring constrains its generic to the property contract before refining concrete literals. Extracted Parameters remain usable without comparing an impossible arbitrary-key intersection. A standalone consumer probe fell from 14.81 seconds to 5.97 seconds; the alias integration passed in 7.28 seconds. Its 10-second subprocess and 15-second integration limits remain unchanged.

Percentage domains support fontWidth, its fontStretch alias, and textSizeAdjust, including nonnegative literals and dimensionally valid math. Zoom accepts percentages. Opacity, fillOpacity, strokeOpacity, floodOpacity, and stopOpacity preserve finite numbers and percentages outside 0–1 for browser clamping. Number/percentage addition remains invalid.

Public source, grammar, type, and browser fixtures cover percentage units, alpha clamping, aliases, importance, and rejection paths. These properties remain partial: escaped numeric spellings, complete tokenization, and broader math still need coverage. See [CSS Color](https://www.w3.org/TR/css-color-4/#transparency), [CSS Fonts](https://www.w3.org/TR/css-fonts-4/#font-width-prop), and [CSS Values](https://www.w3.org/TR/css-values-4/#percentages).

The theme signature now skips redundant whole-map literal refinement at its already-constrained broad boundary, while retaining exact-key checks. Both real theme subprocess integrations pass in 3.36 seconds combined without timeout increases; arbitrary records, callable declarations, undeclared numeric tokens, and malformed literal spellings remain rejected.

Percentage benchmark: the unchanged 100-style module measured 4.3502 ms ±6.01% before and 4.1858 ms ±6.48% after on the same machine without competing heavy work. New percentage lanes measured 0.9308 ms (10 additional styles) and 5.5985 ms (100). Full TypeScript, generated conformance probes, lint, and non-browser integration checks pass. Percentage browser assertions await CI.

Eighty-two prefixed properties now cover finite keyword domains, lengths, colors, percentages, logical borders, outline radii, line clamping, and scalar mask lists. Public names preserve capitalized prefixes: MozAppearance, MsAccelerator, and WebkitUserSelect. MsScrollbar3dlightColor emits the exact historical -ms-scrollbar-3dlight-color spelling.

WebKit logical-border aliases share conflict domains with standard borders. Independent grammar and consumer probes cover all added mappings; native controls cover logical borders in three writing modes and both directions, text fill/stroke, selection, and repeated alias overrides. Legacy Microsoft/Mozilla platform behavior remains unverified; all entries remain partial.

The percentage browser fixture confirms alpha clamping. Current Chromium ignores font-width and retains the font-stretch fallback; the fixture records that capability and an independent native control. See [legacy logical borders](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/-webkit-border-before) and [text stroke width](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/-webkit-text-stroke-width).

The percentage benchmark CI lost the token-inclusive 100-style theme lane: 5.484 ms ±18.58% against Tailwind 4.896 ms ±41.16%. Local confirmation measured 3.6241 ms against 3.6002 ms. Reusing validated token references within one Style.define call reduced the follow-up to 2.4569 ms ±6.01% against Tailwind 3.3350 ms ±28.96%; all five frameworks remain measured.

Cache entries are scoped by property and scalar within one definition; no state persists across calls or themes. Public integration controls cover repeated names in different property groups and successive distinct themes. Browser percentage checks now explicitly record Chromium's missing font-width implementation, with independent native fallback controls.

Prefixed mappings added 82 properties, reaching 505 partial and 165 deferred (135 standard, 30 prefixed). The initial 100-style transform comparison rose from 3.7546 to 4.3133 ms; a clean matched repeat measured 4.0851 ms ±5.74% before and 4.2505 ms ±6.27% after. New prefixed lanes measured 1.2137 ms (10 styles) and 6.2824 ms (100).

Seventeen corner-shape properties accept canonical curvature keywords, finite superellipse numbers, infinity endpoints, numeric math, and their one/two/four-value shorthands. Additional mappings cover all, grid-gap aliases, font-smooth, justify-items/self, position-try-order, and text-box-edge. Corner aliases share conflict domains; all prevents declaration factoring across reset boundaries.

Source and type probes retain arity and dimension restrictions. Browser fixtures compare bevel hit testing with an independent polygon and verify A/B/A declarations around an all reset. These entries remain partial. Contracts follow [CSS Borders](https://www.w3.org/TR/css-borders-4/#corner-shaping).

Path-length remains deferred: the pinned grammar places its range outside the length production, while [the MDN examples](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/path-length) describe unitless numbers. The independent grammar oracle is unchanged pending clarification of that experimental property.

Corner/layout validation passes full TypeScript, lint, generated consumer probes, and source/grammar tests. The same-machine 100-style transform measured 4.0065 ms ±5.94% before and 4.3670 ms ±7.34% after; new 10/100-style lanes measured 1.1467/6.1129 ms. Browser curvature and reset assertions await CI.

The prefixed head passed every standard CI check, but benchmark CI still lost palette (Zyzz 6.576 ms ±62.99%, Tailwind 4.031 ms ±47.00%) and token-inclusive themes (5.093 ms ±19.46%, 4.669 ms ±46.38%). Local confirmation retained all frameworks: palette 1.6219 vs 3.3085 ms; themes 3.0934 vs 4.3162 ms. Neither loss reproduced; gates remain unchanged.

Fifteen compound-value properties add border/mask image slices, widths and outsets; two scrollbar colors; unbounded legacy Mozilla color lists; hyphenation limits; interest-delay pairs; and comma-separated view-timeline insets. Domains distinguish numeric factors, lengths, percentages, colors, integer counts, and times, with explicit arity and fill-marker placement.

Interest-delay shorthands share conflict domains with start/end longhands. Independent source and consumer probes cover repeated scalar grammar; native controls compare border-image painting and computed scrollbar colors. These entries remain partial. See [CSS Backgrounds](https://www.w3.org/TR/css-backgrounds-3/#border-images), [CSS Masking](https://www.w3.org/TR/css-masking-1/#mask-borders), and [CSS Scrollbars](https://www.w3.org/TR/css-scrollbars-1/#scrollbar-color).

Compound-value validation passes full TypeScript, generated consumer probes, source/grammar tests, lint, and the package build. The 100-style transform measured 8.4964 ms ±41.31% before and 7.5531 ms ±30.22% after; the high variance limits conclusions. New 10/100-style lanes measured 1.7317/14.3092 ms. Native painting assertions await CI.

The corner/layout head passed all standard checks, browser tests, and the benchmark workflow. Only the strict 100% conformance gate failed, as expected from the explicitly incomplete inventory.

Intrinsic size overrides and font-size-adjust accept optional component prefixes with dimension and arity checks. Intrinsic shorthand and physical/logical longhands share a cascade conflict domain. Native controls exercise contained sizing. These six properties remain partial pending complete lexical and browser evidence.

Intrinsic prefix validation passes full TypeScript, generated consumers, lint, and source/grammar checks. The same-machine 100-style transform measured 3.8647 ms ±5.32% before and 4.2825 ms ±5.66% after; expanded scalar lanes measured 1.1911/6.5752 ms for 10/100 styles. The six mappings remain partial.

Compound-value CI passed build, checks, and macOS, but the native image-border pixel comparison differed. The follow-up compares all computed border-image components and paints both controls at identical device coordinates, retaining exact pixel equality. CI must verify the revised control and intrinsic sizing.

Grid row, column, and area shorthands accept slash-separated placement lines. Named indices and spans extend all four placement longhands; nonzero indices, positive spans, reserved names, and component limits are checked. Placement declarations share a conflict domain. These three new mappings remain partial.

Intrinsic-sizing CI passed all standard checks and browser tests. Matching device coordinates resolved the exact border-image pixel comparison; computed component equality also passed. The 100% conformance gate remains failing.

Grid placement passes full TypeScript, generated consumers, source/grammar checks, and lint. The 100-style baseline measured 4.2487 ms ±5.96%; an initial 5.2802 ms ±19.17% candidate prompted a repeat at 4.3584 ms ±7.96%. New grid lanes measured 0.7551/4.5315 ms for 10/100 styles. Native layout controls await CI.

Grid span type refinement preserves fractional/negative rejection through importance markers and fallback arrays. Runtime compilation additionally checks named combinations and slash arity. Escaped names and integer math remain incomplete.

Six animation/trigger range endpoints accept named ranges with optional signed length/percentage offsets and comma lists. Standalone normal and active-trigger auto remain exclusive. Native controls compare view-animation progress. These mappings remain partial; trigger event behavior and complete tokenization remain unverified.

Range endpoint validation passes full TypeScript, generated consumers, source/grammar checks, lint, and the package build. The 100-style transform measured 4.2752 ms ±6.08% before and 4.1974 ms ±6.99% after; range lanes measured 0.6734/4.1274 ms for 10/100 styles. Browser progress controls await CI.

The intrinsic-sizing benchmark workflow passed. Grid CI passed native layout controls but found an older rejection diagnostic snapshot; the updated diagnostic passes all retained invalid-count cases locally. Both theme consumer integrations passed in 3.70 seconds combined without changed timeouts.

### Complete Property Mapping and Broader Conformance Evidence

All 670 pinned property entries now have static authoring mappings, including 98 formerly deferred entries. The independent corpus traverses upstream keyword productions and adds compound, custom-property, SVG paint, and paired image-size probes. Runtime CSS value validation remains removed. All entries remain partial until remaining grammar and evidence gaps are reviewed.

A browser matrix compares emitted declarations with native CSS for every engine-supported property and records unavailable browser spellings separately. A second matrix exercises repeated shorthand/longhand overrides, including reset-only relationships. Conditional shorthand conflict groups restore the existing grid workload to 770 gzip CSS bytes while preserving grid-area conflicts. These browser additions require CI because the local Chromium download is unavailable.

The pinned oracle now supplements the missing Linked Parameters production, corrects circle percentage sizing from CSS Shapes, and normalizes SVG 2 path-length range notation. Its upstream fingerprints and the exact 100% completion gate remain unchanged.

The all-property browser and shorthand reset matrices passed on e301d9c, and the benchmark workflow passed with grid CSS at its 770-byte gzip baseline. Follow-up work adds case-insensitive authoring, escaped importance preservation, complete custom-property type probes, and independent compositional grammar samples. These samples exposed additional alignment, image, sizing, font, and keyword combinations; completion remains subject to the expanded checks.

The f9552bb corpus passes 60,892 declaration probes and the new browser matrices, but its CI type checker exhausted a 2 GB heap and five integrations timed out. Follow-up work narrows comparisons to authored properties, preserves annotated records, and keeps generated diagnostics out of the standalone project check. Whitespace and numeric spelling refinements remain static-only. The ordinary TypeScript check now passes with a 2 GB heap limit, using about 1.5 GB. All six focused conformance/theme tests, native lint/types, and the build pass locally; the complete CI rerun remains required.

Compact serialization probes cover 63,738 values and 127,476 declarations. Shared static normalization accepts CSS comments, identifier escapes, whitespace, and zero spellings while retaining numeric token boundaries and ASCII-only keyword folding. Browser conformance now selects every engine-accepted corpus value. The extractor uses the existing structural Style.define call without instantiating the public generic authoring contract for untyped JavaScript; the measured package build fell from 36 seconds to 5 seconds and both previously timed-out integrations pass locally. Native lint/types and ordinary TypeScript with a 2 GB heap pass; complete corpus and browser CI remain required before final coverage promotion.

The bc6e1ca head passed all 315 integrations, including the complete engine-accepted property corpus and escaped CSS controls, plus build, native/ordinary TypeScript, and macOS host checks. These results complete the review for 663 properties under the static authoring contract. Seven grid-placement entries remain partial for the additional signed-integer, named-span, nonzero-index, and slash-limit regressions. The exact full gate remains active.

All 670 property entries are reviewed as supported under the documented static authoring and emission contract. The d2a78d9 head passed grid browser/type regressions, the 63,752-value corpus, build, checks, macOS, and benchmarks. Two unrelated compiler subprocess integrations exceeded the default five-second test budget; matched before/after runs took 8.43/8.38 seconds combined. Explicit ten-second subprocess deadlines within fifteen-second tests bound that work without removing assertions. Final CI must verify the complete inventory and unchanged exact 100% gate.
