# Implementation plan

## Goal

A minimal, type-safe styling system with an environment-independent core, shared web/native authoring, modular extensions, and optional integration adapters. Styles compile ahead of time. Built-in design tokens are an optional preset, and color tokens accept shared values or light/dark pairs.

## Principles

- **Agnostic:** core operates on plain data with no environment, framework, parser, or build-tool dependencies.
- **Universal:** shared style definitions work across rendering targets; target capabilities and output types are explicit.
- **Modular:** presets, source extraction, core semantics, target emission, and host integration have narrow boundaries.
- **Minimal:** ordinary objects and small functions; no mandatory providers, component wrappers, global registries, or plugin framework.
- **Standards first:** prefer CSS properties, values, selectors, at-rules, custom properties, inheritance, and cascade behavior.
- **Compile time:** extract styles without executing application code; runtime logic only selects precompiled alternatives.

## API contract

The proposed signatures, examples, type rules, and emitted theme CSS are specified in [API and architecture](architecture.md). They are implementation targets, not claims about the existing package.

| API                                | Contract                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `css(style)`                       | Existing web shorthand; emits a class string and static CSS                     |
| `Style.define(styles)`             | Defines named, target-independent styles with typed token references            |
| `Theme.define(tokens)`             | Defines token groups; each color is a string or complete light/dark pair        |
| `Theme.extend(theme, overrides)`   | Creates a compatible theme with typed overrides and the same token contract     |
| `Web.compile(options)`             | Emits CSS, named classes, and theme scope classes from in-memory definitions    |
| `Native.compile(options)`          | Emits static style tables for each supplied theme and color scheme              |
| `Native.select(styles, options)`   | Selects an existing theme/scheme table without compiling or merging             |
| `theme.css(style)`                 | Infers property-specific tokens and compiles directly to readable class strings |
| `theme.className`                  | Optional scope for inherited theme overrides                                    |
| `typestyle <src> --out-dir <dist>` | Standalone module rewriting and stylesheet emission; planned watch/minify flags |

## Current baseline — complete

The prototype compiles typed literal `css()` calls into deterministic scoped CSS. It includes built-in palette and layout tokens, a development integration, a standalone library compiler, examples, and 29 behavioral tests plus type fixtures.

Source extraction, CSS emission, and an environment-specific hash implementation are still coupled. Token values contain web-specific strings. Custom themes and native output do not exist yet. Existing results are recorded in `validation.md` and establish only the web baseline.

## Phase 1 — Extract the core

Status: next.

- [ ] Separate ordered style data, token references, validation, diagnostics, and deterministic identity from parsing and emission.
- [ ] Implement `Style.define` and the pure in-memory compilation boundary specified in the architecture.
- [ ] Remove environment-specific imports from the core dependency graph; specify portable identities and collision handling.
- [ ] Move binding analysis, source rewriting, maps, file access, and watching into adapters.
- [ ] Make the default preset explicit; support empty and custom presets without global configuration.
- [ ] Preserve the existing web shorthand and examples while extracting these boundaries.

Gate: identical core results across server, browser, worker, and native-engine fixtures. Core imports do not pull in parsers, frameworks, rendering targets, or file access. The current web regression suite still passes.

## Phase 2 — Standard authoring and themes

Status: planned.

- [ ] Implement the `Theme.define` and `Theme.extend` contracts before widening authoring syntax.
- [ ] Accept token groups directly with no metadata or scheme container. Each color leaf is `string | { light: string; dark: string }`; require both fields for pairs.
- [ ] Infer `theme.css` arguments from shared `color` and property-specific `backgroundColor`, `textColor`, and `borderColor` groups, with documented fallback and override rules. Reject wrong domains, unknown tokens, partial pairs, and incompatible extensions.
- [ ] Derive internal theme identities without caller metadata; extensions retain base token identities independently of values. Switching theme scopes must not require recompiling component classes.
- [ ] Make bound styles work without a root scope using custom-property fallbacks; expose `theme.className` for inherited overrides and retain the directly imported default `css`.
- [ ] Recognize imported and destructured theme functions with full inference and static extraction.
- [ ] Emit scoped custom properties and `light-dark()` values. Support `color-scheme: light`, `dark`, and `light dark`, independently of theme identity.
- [ ] Specify nested scope inheritance, complete overrides, independently forced schemes, deterministic server output, and undeclared-theme failures.
- [ ] Preserve standard declaration order, selectors, at-rules, inheritance, and cascade semantics. Revisit the prototype's escapes and implicit condition sorting.
- [ ] Support same-module immutable definitions and spreads through static binding analysis; add imported definitions only with explicit resolution and cycle errors.

Gate: two compatible themes each work in both schemes. Switching a scope changes colors and shared tokens through CSS alone. Nested themes and explicit schemes behave as specified. Invalid definitions fail without evaluating application code.

## Phase 3 — Web and native output

Status: planned.

- [ ] Implement `Web.compile` as a pure emitter returning CSS, named classes, and theme scope classes. Theme maps name outputs without adding definition metadata.
- [ ] Emit deduplicated atoms with readable property/token/condition names and deterministic collision suffixes, retaining names in production.
- [ ] Preserve ordered groups for conflicting declarations and conditions; verify cascade equivalence before deduplication.
- [ ] Prune unreachable rules and unused variables while retaining complete live token sets in theme scopes.
- [ ] Implement `Native.compile` as a pure emitter returning complete static tables for every requested theme/scheme pair.
- [ ] Implement `Native.select` as a lookup only. System scheme, interaction, viewport, and accessibility inputs belong to application or host adapters.
- [ ] Prove the same named style definitions with shared tokens on web and native before expanding coverage.
- [ ] Specify native unit conversion and font handling; require explicit configuration where no portable default exists.
- [ ] Document target support for selectors, queries, custom properties, CSS functions, text inheritance, units, and state. Unsupported semantics must fail rather than disappear silently.
- [ ] Keep scheme-specific output and runtime selection outside the core; do not emulate a browser CSS engine on native.

Gate: shared definitions render on web and both mobile platforms. Theme/scheme selection agrees with the documented conversions. No runtime style generation is needed, and target-aware types reject unsupported declarations.

## Phase 4 — Integrations and distribution

Status: planned.

- [ ] Verify plain document, component, template, and native consumers through their normal class/style APIs.
- [ ] Expand the existing CLI with `--css`, `--watch`, and `--minify`; rewrite modules alongside CSS and declarations, requiring no styling plugin in consumers.
- [ ] Verify CLI/build/in-memory parity, dependency watching, output exclusion, diagnostics, failure preservation, and owned-output cleanup.
- [ ] Keep build integrations optional and thin; implement only those needed by concrete fixtures.
- [ ] Support framework source boundaries in source adapters without leaking template syntax into core semantics.
- [ ] Compile from in-memory definitions and from source adapters using the same target emitters.
- [ ] Distribute web modules, declarations, and CSS; distribute native modules, declarations, and static theme tables. Consumers do not need compiler integrations.
- [ ] Verify server rendering, hydration identity, refresh behavior, source maps, and add/edit/remove/rename recovery.
- [ ] Test independent packed consumers and ensure unused targets, parsers, and tools stay out of runtime dependencies.

Gate: all integration paths use the same contracts and agree on identity. Theme classes and tables survive packaging. Web output has no styling runtime; native output includes only any explicitly selected lookup adapter.

## Phase 5 — Simplify and measure

Status: planned.

- [ ] Review every API and dependency against the principles; remove abstractions that duplicate platform behavior.
- [ ] Measure compilation, incremental updates, type-check cost, raw/compressed CSS, class-string bytes, total transfer, browser style recalculation, and native adapter cost independently.
- [ ] Measure theme multiplication and generated-table size; deduplicate without changing observable theme or cascade semantics.
- [ ] Compare atomic and grouped output on repeated and unique styles; optimize the smaller safe representation. Add variants or recipes only when concrete usage justifies them.
- [ ] Keep the repository and package private until publication is requested.

Gate: a small documented API, tested compatibility matrix, reproducible measurements, and working independent web/native consumers.

## Acceptance matrix

| Area           | Required proof                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Core           | In-memory operation without environment, framework, parser, or build-tool dependencies                   |
| Types          | Named styles and token domains infer precisely; invalid schemes and overrides fail                       |
| Themes         | Colors accept shared strings or light/dark pairs; extensions share inferred token identities             |
| Web scopes     | Custom-property inheritance, nested themes, and explicit/system schemes work without a theme runtime     |
| Native schemes | Every theme/scheme pair is precompiled; selection is a deterministic lookup                              |
| Standards      | CSS values, selectors, at-rules, declaration order, and cascade retain their semantics                   |
| Integration    | Document, component, template, native, server, and library consumers share the same contracts            |
| Minimalism     | No required providers, wrappers, global setup, platform detection, or runtime compilation                |
| CLI            | Standalone compilation rewrites calls, emits CSS, and matches other adapters; watch recovers from errors |
| CSS output     | Readable stable names, collision safety, small measured artifacts, and unchanged cascade behavior        |

## Scope

The API and phases above are proposed. This revision updates documentation only; it does not implement custom themes, portable-core extraction, or native output. The web baseline remains usable while these phases land.
