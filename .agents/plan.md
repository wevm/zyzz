# typestyle implementation plan

## Goal

A minimal, primarily type-safe alternative to Tailwind and StyleX: ordinary TypeScript style objects, Geist colors and typography, Tailwind layout tokens, and CSS generated entirely during development transforms or production builds. A library can publish compiled JavaScript, declarations, and CSS without imposing a compiler on its consumers.

## Invariants

- No application code is executed to discover styles. No runtime stylesheet engine or injection in production. Vite's own dev CSS delivery is expected.
- Token domains are explicit. A color cannot accidentally be a spacing or radius token. Arbitrary CSS requires a visible `[value]` escape.
- Unsupported static syntax is a source-located error; it must never silently fall back to runtime evaluation.
- One compiler owns class naming, token resolution, declaration order, and condition ordering. Vite and standalone builds share it.
- Identical styles have identical class names across files and adapters. Import bindings, not names or text matching, identify the macro.
- Application styles stay in normal `.ts` and `.tsx` files. No `.css.ts` convention, generated source files, or custom JSX runtime is required.
- Preserve the Monoshot-derived agent guidelines in `AGENTS.md`. Record provenance when adapting repo-specific rules.

## Phase 0 — Contract and repository foundation

Status: implemented. The private `wevm/typestyle` repository is verified and contains the initial MVP.

- [x] Retrieve `wevm/monoshot/AGENTS.md`, record its blob SHA, and adapt only project-specific conventions.
- [x] Define the one-function API: `css(style) -> string` at compile time.
- [x] Record architecture, output contracts, token provenance, and non-goals.
- [x] Establish strict TypeScript with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
- [x] Verify private visibility and populate the supplied `wevm/typestyle` GitHub repository.

Exit gate: repository is private, the initial commit is reachable, and the contract is reviewable without running the compiler.

## Phase 1 — Working vertical slice

Status: implemented and verified locally.

- [x] Provide the 92 Geist sRGB color steps with paired light/dark values, Geist typography and font stacks.
- [x] Provide Tailwind v4 numeric spacing, radii, breakpoints, shadows, and easing.
- [x] Type common CSS properties, tokens, pseudo-classes, data attributes, and responsive conditions.
- [x] Compile named and aliased `css` imports from literal TS/TSX objects into deterministic class strings and scoped rules.
- [x] Reject runtime values, computed keys, spreads, getters, macro aliasing, re-exports, unsupported properties, and invalid tokens.
- [x] Integrate with Vite's real transform, CSS asset, and dev-server module paths.
- [x] Emit standalone ESM, declarations, and aggregate `styles.css`, with a manifest for safe repeat builds.
- [x] Add a Vite demo and a precompiled library example.
- [x] Complete the local acceptance matrix and record results in `validation.md`.

Exit gate: a typed button works in dev, production, and a library consumer with no typestyle plugin. Invalid tokens fail type checking; invalid static input fails compilation; production JavaScript has no styling engine.

## Phase 2 — Static authoring and cascade hardening

Status: planned; first follow-up after the POC.

- Add same-module immutable constants and object spreads using lexical binding analysis and cycle detection. Still never evaluate JavaScript.
- Design a constrained cross-module token/constant contract before implementing imported expressions.
- Define an explicit composition API and conflict rules for shorthands, longhands, responsive conditions, and pseudo-classes. Never imply that class-attribute order determines CSS precedence.
- Expand property coverage and remove any remaining property-specific keyword ambiguities; add inference and negative type fixtures for every public addition.
- Consider variants only after at least three concrete usage examples establish a common shape. Runtime selection may select precompiled classes; it must not generate CSS.
- Add P3 color enhancements and source-pinned token regeneration with drift checks.
- Specify a stable custom-theme contract, CSS custom-property overrides, and nested theme scopes.

Exit gate: shared styles and common component variants compile without runtime evaluation; all composition outcomes are independent of import order; tokens remain strongly typed after extension.

## Phase 3 — Development and library compatibility

Status: planned.

- Verify React Fast Refresh preserves component state on style edits. The vanilla demo may reload through normal Vite HMR boundaries.
- Consider stable dev identities for CSS-only updates if measured usage shows that JS invalidation is disruptive; preserve collision safety across packages.
- Exercise file additions, renames, deletions, changed imports, plugin reuse, watch builds, and recovery after errors.
- Add real-browser assertions for computed styles, light/dark changes, responsive rules, keyboard focus, and reduced motion.
- Add Vite SSR and framework-specific integration fixtures. Test multiple supported Vite versions before broadening the compatibility claim.
- Emit composed standalone JS source maps and CSS-to-source tracing. Keep transformed module source maps accurate.
- Verify tarball installation into an independent consumer, relative imports, package exports, `.d.ts`, CSS `sideEffects`, and dependency externalization.
- Decide on explicit CSS imports versus a separate style-importing library entrypoint. Keep the core library import safe for Node/SSR.

Exit gate: fresh dev sessions and production/SSR/library consumers agree on classes and CSS; rebuilds remove obsolete styles; consumers do not need typestyle installed solely for runtime rendering.

## Phase 4 — Measure, simplify, and release an alpha

Status: planned; no unmeasured performance claims.

- Benchmark cold and warm transforms on 100, 1,000, and 10,000 style calls; record machine, Node, dependency versions, median, and p95.
- Compare output bytes, gzipped bytes, and incremental build latency with representative Tailwind and StyleX projects using equivalent styles.
- Prototype atomic deduplication only if output measurements justify its cascade and composition complexity.
- Target zero production styling-runtime bytes; target <50ms p95 for one 100-style module after warm-up, subject to measurement.
- Review token attribution, dependency licenses, modern CSS browser support, package naming, and the supported static subset before publishing.
- Keep `private: true` until publishing is explicitly authorized. Creating the private GitHub repository is already authorized.

Exit gate: reproducible benchmark report, reviewed limitations, small stable public API, and a reproducible package consumed outside the monorepo.

## Acceptance matrix

| Area       | Required proof                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Types      | Valid tokens infer correctly; invalid properties, values, and nested conditions fail `tsc`     |
| Compiler   | Binding-aware aliases/shadowing; TSX; no source execution; deterministic output; useful errors |
| CSS        | Correct token units, shorthand order, breakpoint order, pseudo rules, dark values, typography  |
| Vite prod  | Real Vite build emits CSS and erases macro imports/calls from JavaScript                       |
| Vite dev   | Real server serves virtual CSS; an edit updates it; removing styles empties it                 |
| Library    | Emits ESM + declarations + CSS; output can be consumed without compilation                     |
| Rebuilds   | Stale owned files disappear; unrelated assets and previous good builds survive failures        |
| Repository | Formatting, type checking, tests, example builds, clean diff, private remote verified          |

## Deliberate POC boundaries

No atomic CSS, conflict-aware class merging, recipes, dynamic style values, imported style constants, custom theme compiler, P3 enhancement, keyframes, SSR guarantee, or standalone watch mode. No Tailwind or StyleX runtime dependency. Tailwind is only a development-time token reference. The included fonts are example dependencies and are not copied into the core package.
