# typestyle implementation plan

## Goal

A minimal, type-safe styling system with an environment-independent core, a shared authoring model for web and React Native, and optional adapters for frameworks and build tools. Styles are compiled ahead of time. Geist colors and typography and Tailwind design tokens ship as an extensible preset.

## Principles

- **Agnostic core.** Pure functions and plain data. No Node built-ins, filesystem, DOM, React, Vue, React Native, Vite, Metro, or compiler-tool APIs in the core dependency graph.
- **Universal and isomorphic.** The same core runs in browsers, servers, workers, and native JavaScript environments. Shared declarations remain portable; target-specific capabilities are explicit and typed.
- **Modular and extensible.** Separate style semantics, presets, source extraction, target emission, and host integration. Extensions are explicit data or small functions passed at the boundary. Start with modules and subpath exports; split packages only when necessary.
- **Minimal and simplistic.** Keep the authoring surface small and use ordinary objects. No mandatory providers, component wrappers, custom JSX runtime, global registries, plugin framework, or configuration DSL.
- **Standards first.** Prefer CSS property names, values, selectors, at-rules, custom properties, inheritance, and cascade behavior. Introduce new syntax only where type safety or a target boundary requires it.
- **Compile-time styles.** Never execute application code during extraction. Web emits CSS and class references; native emits static style data. Runtime code may select precompiled styles for state or theme, but must not parse or generate new styles.

## Current baseline — complete

The private `wevm/typestyle` repository contains a working web POC: typed literal `css()` calls, Geist and Tailwind tokens, deterministic scoped CSS, a Vite adapter, a standalone library compiler, examples, and 29 behavioral tests plus type fixtures.

This is a web baseline, not yet the universal core. `Compiler.ts` couples source parsing and CSS emission and imports `node:crypto`. Tokens include web-specific CSS strings. The public helper returns a class string, and React Native is not implemented. Existing results are recorded in `validation.md`; they do not establish the future compatibility gates below.

## Phase 1 — Extract the agnostic core

Status: next implementation phase.

- [ ] Separate declaration validation, ordered style data, token resolution, diagnostics, and deterministic identity from source parsing and target output.
- [ ] Remove `node:crypto` and all environment-specific imports from the core. Choose a small deterministic identity implementation with the same results in every supported environment and an explicit collision strategy.
- [ ] Move Babel binding analysis and source rewriting behind a source-extraction adapter. Keep parser nodes and tool-specific source maps outside core contracts.
- [ ] Define a small pure compilation boundary: explicit inputs and options in, artifacts and structured diagnostics out. File discovery, resolution, reads, writes, watching, caches, and logging belong to host adapters.
- [ ] Make Geist/Tailwind defaults an explicit preset selected at the public boundary; the core must also work with an empty or custom preset.
- [ ] Keep Vite and the CLI as consumers of the same core API. Neither may define style semantics.
- [ ] Retain the working web entrypoint during extraction. Avoid new public abstraction layers unless the web and native targets require them.

Exit gate: core imports and executes without Node or browser globals; equivalent inputs produce identical ordered data and identities in server, browser, worker, and native-engine fixtures. The existing web tests and output contracts still pass. Importing core or types does not pull in a parser, bundler, framework, or filesystem adapter.

## Phase 2 — Establish standard authoring and extension contracts

Status: planned; complete before expanding the API.

- [ ] Use canonical CSS names with the normal camelCase object spelling. Preserve declaration order and document shorthand, longhand, inheritance, specificity, and source-order behavior.
- [ ] Support typed CSS values and standard functions directly where practical. Revisit the POC's mandatory `[value]` escape; do not require a utility-class convention for ordinary CSS syntax.
- [ ] Use standard selectors and at-rules as the underlying condition model. Breakpoint aliases and other conveniences belong to optional presets and expand to explicit standard conditions.
- [ ] Preserve authored CSS precedence. Review the POC's automatic pseudo/breakpoint sorting; any preset ordering must be explicit rather than a hidden alternative cascade.
- [ ] Define portable declarations separately from web-only and native-only declarations. Selecting a target constrains accepted properties, values, conditions, and output types.
- [ ] Add custom tokens and preset composition without widening known token domains to arbitrary strings. Store semantic theme values independently of CSS serialization.
- [ ] Support same-module immutable constants and spreads with binding analysis and cycle errors. Define an explicit resolver contract before supporting imported constants; never evaluate them as JavaScript.
- [ ] Use ordinary composition and target-native precedence before adding helpers. A web class list must not claim that its string order overrides CSS rules.

Exit gate: default, empty, and custom presets retain useful inference. Standard CSS values and conditions round-trip through the web target. Unsupported target capabilities fail with source-located diagnostics. Extension examples require no edits to core internals.

## Phase 3 — Web and React Native targets

Status: planned.

- [ ] Extract a web emitter producing static CSS and class references, usable without React or Vite. Preserve CSS custom properties, media queries, selectors, and the native cascade rather than emulating them in JavaScript.
- [ ] Add a native emitter producing precompiled style objects or equivalent static data accepted by React Native's style APIs. Do not pass CSS class strings to native components.
- [ ] Prove one shared tokenized style definition for a simple layout/text component on web and native before extending property coverage.
- [ ] Specify conversion of spacing, radius, typography, colors, and units. Make the native base for rem-derived tokens explicit and configurable; do not assume a browser root font size exists.
- [ ] Define theme, viewport, interaction, and reduced-motion inputs at target adapter boundaries. Any native runtime helper only selects among precompiled alternatives; core never reads device state.
- [ ] Create a documented capability matrix for selectors, pseudo-classes, media/container queries, CSS variables/functions, text inheritance, units, and platform-specific values. Reject unsupported features rather than dropping or approximating them silently.
- [ ] Keep the portable type surface useful while allowing explicit target extensions. Do not simulate the entire browser CSS engine on native.

Exit gate: shared definitions render correctly in a browser and React Native on iOS and Android. Target-aware type fixtures reject unsupported features; common token values and documented conversions agree. Native theme/state changes select static output without runtime compilation.

## Phase 4 — Thin integrations and library distribution

Status: planned.

- [ ] Verify plain DOM, React, and Vue consumers of the same web output, plus React Native consumers of native output. No framework is required by the authoring core.
- [ ] Keep Vite integration optional. Add only the minimal Metro/native integration needed for the native fixture; do not build adapters for every bundler in advance.
- [ ] Handle TS/TSX and Vue SFC script boundaries through the relevant source adapter. Template syntax must not leak into core semantics.
- [ ] Expose compilation from in-memory inputs independently of a filesystem CLI. Library authors can emit artifacts using their existing build tooling.
- [ ] Publishable web output consists of ESM, declarations, and CSS; native output consists of ESM/static styles and declarations. Consumers need no typestyle compiler integration to use precompiled libraries.
- [ ] Verify source maps, SSR/hydration identity, framework refresh/state retention, native fast refresh, and add/edit/remove/rename recovery. Watch state stays within each adapter instance.
- [ ] Keep target entrypoints explicit and tree-shakeable; avoid implicit platform detection and global setup. Test packed artifacts in independent consumers.

Exit gate: Vite, standalone/in-memory, React, Vue, and Metro integrations consume the same core contracts. Web dev/prod/SSR agree on output identity. Precompiled web and native packages work without the compiler, and imports do not drag unused targets or tools into consumers.

## Phase 5 — Simplify and measure

Status: planned.

- [ ] Review each public API and dependency against the five design principles. Remove helpers that duplicate standard CSS or existing framework behavior.
- [ ] Measure cold/warm compilation, incremental updates, declaration/type-check cost, artifact bytes, and runtime adapter bytes separately for web and native.
- [ ] Benchmark realistic shared styles at 100, 1,000, and 10,000 declarations with reproducible environments; make no unmeasured performance claims.
- [ ] Keep production web styling-runtime bytes at zero. Budget and document any native adapter code separately; do not label native state selection as runtime compilation.
- [ ] Consider atomic deduplication, variants, or recipes only when real usage and measurements justify the additional API and precedence rules.
- [ ] Keep the repository and package private until publication is explicitly requested.

Exit gate: a small documented API, a tested target/environment compatibility matrix, reproducible measurements, and working independent web/native consumers.

## Acceptance matrix

| Principle           | Required proof                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| Agnostic core       | No environment, parser, framework, or build-tool dependencies; callable on in-memory inputs     |
| Isomorphic behavior | Identical core results across server, browser, worker, and native-engine fixtures               |
| Universal authoring | A shared definition compiles for web and native; target-only features are explicitly typed      |
| Standards           | Web values, selectors, at-rules, inheritance, and cascade preserve documented CSS semantics     |
| Extensibility       | Empty/custom/default presets and an independently defined target extension preserve inference   |
| Minimalism          | No providers, wrapped components, custom JSX runtime, global registry, or mandatory integration |
| Compile-time output | Web CSS and native static styles are emitted ahead of time; no application-code evaluation      |
| Integration         | DOM, React, Vue, React Native, SSR, and independent library fixtures use shared core contracts  |
| Compatibility       | Unit, theme, state, and unsupported-feature behavior is documented and tested per target        |

## Scope

This revision changes the plan and repository conventions, not the implemented compiler architecture. React Native, the portable core, and the new extension contracts remain planned. The current web examples keep working while those phases are implemented. No CSS polyfill engine, component library, universal component wrapper, or general-purpose plugin framework is planned.
