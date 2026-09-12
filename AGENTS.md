# Adapted from wevm/monoshot

Source: https://github.com/wevm/monoshot/blob/main/AGENTS.md
Source blob: `2ea42a70839750bce15260db0b9350329f8d72b3`. Retrieved 2026-09-07. General coding conventions are retained; project principles, UI, layout, and commands are adapted for Zyzz.

# Agent Guidelines

## Project Principles

- Keep core functions pure and environment-independent. Node built-ins, filesystem, DOM, device APIs, parsers, frameworks, and build tools belong in adapters.
- Share typed authoring across web and React Native while making target capabilities and output types explicit. Unsupported target semantics must produce errors.
- Keep modules small and extensible through explicit data and narrow functions. Avoid global registration, mandatory providers, component wrappers, custom JSX runtimes, and general plugin frameworks.
- Prefer CSS properties, values, selectors, at-rules, custom properties, inheritance, and cascade patterns. Preserve authored ordering; convenience syntax must expand predictably.
- Compile styles ahead of time. Runtime adapters may select static alternatives but must not generate or compile styles.
- Keep root `css` and `variants` token-free. Put Geist and Tailwind design tokens in the opt-in `zyzz/themes/default` entrypoint, exporting bound `css` and `variants`, the full `theme`, and raw `tokens`. Core imports must not include bundled theme data.

## TypeScript Conventions

- Treat `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` as design constraints. Include `| undefined` when an optional property can explicitly receive `undefined`, and narrow indexed reads before use.
- Use `readonly T[]` for array types. Preserve mutable arrays only when mutation is part of the contract.
- Use `type` for project-owned shapes. Use `interface` only when declaration merging or an external ambient contract requires it.
- Include `.js` extensions on relative imports and exports so source remains valid under NodeNext ESM.
- Author every source file and script in TypeScript; `.js` files are banned. Node runs TypeScript natively (`node script.ts`), so scripts need no build step.
- Import module-shaped internal files as namespaces (`import * as Store from './Store.js'`) and access members through the module name. Named imports are fine for types, leaf helpers, command handlers, and third-party APIs that are not module namespaces.
- Import Node built-ins as namespaces unless the neighboring code or API is clearer with a named import.
- Re-export public module files as namespaces (`export * as Store from './Store.js'`). Avoid flattening sibling-module symbols into a barrel.
- Use static imports. Reserve dynamic imports for a real runtime or bundle boundary, not dependency-cycle workarounds.
- Use `import type` and `export type` where an import or export is type-only.
- Use functions and plain data for normal APIs. Classes are limited to errors and framework-required entrypoints such as Durable Objects.
- Keep error classes in the module that throws them, ordered alphabetically with its public exports. Set custom error `name` values to the namespaced form, such as `Config.InvalidError`.
- Use unions or `as const` objects instead of enums.
- Prefer `camelCase` constants. Preserve uppercase names only when they mirror an external protocol or established neighboring code.
- Use `const` generic parameters when callers should retain literal or tuple types.
- Default optional option bags in the signature (`options: fn.Options = {}`), not with `options?: fn.Options` and downstream fallback logic.
- Name typed option bags `options`. Use a domain noun only when the value is not an options bag.
- Prefer one named object parameter over several positional parameters. An instance-like receiver such as `client`, `cache`, or `store` may be the first positional parameter, followed by an options bag.
- Put a function's parameter, return, and error types in a matching `declare namespace` (`resolve.Options`, `resolve.ReturnType`, `resolve.ErrorType`). Keep a sibling exported type only when several functions share the domain type.
- Avoid inline object types on local variables. When an explicit local object type improves clarity, name it directly above the use.
- Do not extract a named type until it is reused or makes a difficult shape materially easier to read.
- Keep shared domain types beside the module that owns the concept.
- Group a module's Zod schemas in a `schema` namespace, and derive their types beside them (`schema.Document`). Export the namespace only when another module validates against the same shape.
- Let declared return types constrain intermediate expressions. Avoid redundant local annotations.
- Return values directly unless a binding is reused or gives a complex expression a useful name.
- Prefer immediately invoked function expressions (IIFEs) with explicit branches and early returns over nested or complex ternary expressions. Keep simple two-way ternaries when both branches are easy to scan. This applies to executable code, not TypeScript conditional types.
- For a fallible local derivation, prefer an IIFE expression over a mutable variable assigned across `try` and `catch` blocks.
- Destructure when reading several properties. When normalizing one field, read `options.field` directly instead of creating a second name.
- Prefer short names whose meaning is clear from local context, such as `options`, `client`, `entry`, and `fn`.
- Keep wire formats, ordered tuples, protocol fields, and other order-sensitive shapes explicit. Do not alphabetize data whose order has meaning.
- Avoid new `any`. Use a precise boundary type, validation, narrowing, or the smallest justified assertion.
- Separate distinct contexts and logical steps with one blank line in every maintained module, including source, adapters, scripts, benchmarks, and test fixtures. Group setup, guard clauses, derivation, mutation or emission, and final returns so each step is easy to scan.
- Keep a lookup with its immediate guard, related local declarations, and consecutive assertions together. Separate independent branches, loops, local helper functions, and the work following a completed control-flow block. Avoid both dense uninterrupted logic and a blank line after every statement.
- Separate test setup, execution, and assertions; keep each assertion group beside the operation it verifies. Preserve spacing inside generated source strings, snapshots, and other whitespace-sensitive fixtures.
- Audit logical spacing when adding or editing a module; formatting tools do not infer context boundaries. Review the surrounding function as well as the changed lines, and keep spacing-only edits free of behavior changes.
- Do not use section-divider comments. Use exports, TSDoc, and whitespace to express module structure.
- Comment invariants and non-obvious reasons, not line-by-line mechanics. Keep comments independent of plans, task IDs, and prior versions.

## Alphabetical Ordering

- Alphabetize imports, named import/export specifiers, public exports, type/interface properties, object properties, enum/union members, unordered lists, configuration maps, scripts, and dependencies. Use case-insensitive lexical order consistently.
- Keep attached documentation with the declaration or property it describes. Keep function overloads and their namespace together. Order local declarations alphabetically within dependency-compatible groups; do not introduce use-before-initialization or reorder execution.
- Preserve order with observable semantics: authored CSS declarations, fallbacks, cascade layers, variant/compound precedence, tuples, package file inclusions followed by exclusions, workflow steps, and regression fixtures testing those orders. Mark intentional exceptions in nearby documentation or comments. The compiler must never sort consumer styles.
- Keep `name` and `on` first in GitHub workflows; alphabetize the remaining top-level keys. Preserve the scaffold package.json group order around `[!start-pkg]`; alphabetize entries within each group. Do not alphabetize prose sections or sequential implementation phases mechanically.

## Module and Instance Conventions

- Organize each module file as one conceptual namespace containing its public types, constants, functions, and errors. Consumers should read calls as `Module.operation(...)`.
- Prefer stateless module functions for pure behavior. Do not create an instance when inputs fully describe the operation.
- When behavior needs dependencies or lifecycle state, expose a factory such as `Module.create(options)` or `Module.runtime(options)` that returns a plain object of operations and data.
- Construct instances explicitly at the application boundary and pass them down. Do not hide construction in imports or module-scope singletons.
- Scope an instance to the lifecycle that owns its state, such as one CLI run, Worker isolate, request pipeline, or test. Do not share mutable state more broadly than required.
- Inject environment-specific capabilities through factory options or narrow structural types. Keep filesystem, network, cache, clock, and platform bindings out of domain modules.
- Type dependencies by the smallest capability the module consumes, not by the concrete SDK client. This keeps adapters interchangeable without wrapper classes.
- Let factory operations close over shared dependencies and state. Do not return methods that depend on `this` or require binding.
- Name the returned public shape after its role (`Runtime`, `Client`, `Cache`, `Store`) when that role is meaningful. Use `create.ReturnType` for a factory-specific shape that has no independent domain name.
- Keep one authoritative instance value. Derive related helpers and views from that instance instead of duplicating configuration or state.
- Keep mutable caches and registries private to the instance. Expose explicit operations, and provide reset or disposal only when the lifecycle requires it.
- Avoid side-effect registration. `sideEffects: false` means an import used only to install global behavior can disappear from a bundle.
- Keep default implementations directly reachable from the factory or resolver that selects them so bundlers can tree-shake unused paths.
- Pass an existing receiver first to stateless operations (`Github.publish(client, options)`). Create a factory only when several operations genuinely share dependencies, state, or lifecycle.
- Keep transport-independent planning, parsing, and normalization pure. Put filesystem, GitHub, and Worker behavior in thin adapters around that core.
- Keep internal helpers under `internal/` and export them only when another module has a real contract with them.
- Add new public modules through the owning entrypoint as documented namespace exports. Keep the public surface lean and derive values that the library already knows.
- A framework-mandated class should delegate reusable logic to module functions so the class remains a small lifecycle adapter.

## Type Inference Conventions

- Preserve literal inputs through public helpers when those literals affect the output type.
- Keep generic types flowing from inputs through callbacks and return values. Do not erase them to `any` at an internal seam.
- Prevent public callbacks, options, and return values from leaking `any`.
- Add consumer `.test-d.ts` fixtures beside their owning module (for example, `src/Style.test-d.ts`) with `expectTypeOf` and expected compiler errors when public inference or narrowing changes. Import public entrypoints; ensure the fixtures are actually checked by TypeScript.
- Revisit inference after changing an API. Prefer a narrower useful contract over a broad type that merely compiles.

## Abstraction Conventions

- Start with concrete code and extract only after repeated uses reveal a stable shared contract.
- Prefer small local duplication over an abstraction that adds flags, modes, or call-site-specific branches.
- Wait for at least three concrete uses before introducing a general abstraction unless a hard boundary already exists.
- Optimize for code that is easy to change, not maximum DRYness.
- Keep authoritative state, configuration, schemas, and constants in one place; derive dependent values.
- Avoid wrappers that only rename another function or mirror an SDK without narrowing capabilities or adding a domain contract.

## Documentation Conventions

- Start every maintained TypeScript module with a brief standalone TSDoc `@module` comment describing its responsibility. Place it before imports, or after a required shebang. Include entrypoints, internal modules, tooling, fixtures, integration tests, type fixtures, and benchmarks; describe the module rather than repeating its filename. Keep export-level TSDoc separately.

- Add TSDoc to every public export and public type property. Write or update the contract documentation alongside the implementation.
- Document caller-visible purpose, inputs, output, defaults, errors, and side effects. Keep low-level wiring in nearby implementation comments.
- Keep examples small and focused on the exported behavior. Prefer a snippet, concrete example, or useful visual to a long conceptual explanation; avoid repeating what the example already shows.
- Keep prose paragraphs under 50 words and focused on one idea. Use bullets for enumerable content and tables for comparisons. Tighten wording rather than mechanically splitting paragraphs.
- Mark preview or unimplemented APIs with GitHub Markdown `> [!NOTE]` callouts scoped to the affected content. Do not add “Available” labels or status suffixes to headings. Examples must preserve the documented contract and must not imply preview APIs already work.
- Order consumer documentation by common tasks: getting started, styling, themes, and variants before compiler internals. Use focused guides with end-to-end examples; show CLI and bundler setup variants in Getting Started. Preserve this intentional reading order instead of alphabetizing navigation.
- Maintain four consumer documentation areas: Introduction, Concepts & Principles, Guides, and API. Keep concepts on one page; theme scopes belong within Themes & Tokens. API navigation follows entrypoint, export/module, then method; document signatures, examples, parameters, returns, types, and errors alongside public exports.
- Keep guide titles in Title Case with fewer than four words. Group guides by topic, with a Recipes section containing focused tasks; preserve recipe coverage when consolidating pages.
- Use API tables with descriptions in entrypoint and module overview pages. Give each parameter and returned property its own subheading, type, description, and small usage snippet; document defaults where applicable. Keep preview type names and unresolved defaults explicitly provisional.
- Export config helpers directly with `export const { css, variants, theme, ... } = Config.create(...)`, selecting the helpers needed by the application. Consume named imports such as `{ css, variants, theme }`; do not recommend a `zyzz` config instance or `zyzz.*` member access. Config modules need no default export. The Vite and Next.js plugin functions remain named `zyzz`.
- Group related `css` and `variants` definitions in `namespace styles {}`, with exported `const` members and `styles.card()` or `styles.button(options)` at application sites. Use this convention throughout README, docs, architecture examples, and application fixtures. Use `export namespace styles` in shared style modules. Keep reusable literal declarations inside the namespace and reference earlier declarations directly. Namespaces belong at module scope and require TypeScript lowering. Keep focused API parameter snippets and fixtures testing other supported syntax when that syntax is the subject of the example or test. Overview usage should show two styles applied to nested elements in a component.
- Select named themes with `themes({ theme: 'mint', colorScheme: 'dark' })`, with inferred catalog keys and an optional scheme; do not recommend `themes.mint()` or `themes[name]()`. Keep preview status explicit until callable selection is implemented. Access shared token and variable references through `theme.tokens` and `theme.vars`.
- Document the Vite plugin as a named `zyzz` function from `zyzz/vite`, called with `plugins: [zyzz()]`.
- Document the Next.js integration as `zyzz(nextConfig)` from `zyzz/next`. It wraps existing configuration and owns Webpack/Turbopack wiring without requiring separate Babel or PostCSS setup. Keep preview notes until both bundler paths are verified.
- Update the owning entrypoint documentation when adding or changing a public module.

## Prose Conventions

Applies to documentation, comments, TSDoc, commit messages, and pull requests.

- Write about the code, not about the person using it. Avoid second person.
- Describe behavior in technical terms rather than by the experience it produces. Prefer `answers before acquisition finishes` over `keeps the editor feeling fast`.
- State an invariant or a reason the code cannot show on its own. Leave out justification the code already makes plain.
- Vary sentence construction. One shape repeated across a file, such as an assertion followed by a colon and its reason, reads as a writing style rather than as information.
- Keep PR titles and bodies short and concrete. Explain the problem and resulting behavior in a few sentences, include one small example, and add one validation line. Use a usage snippet, before/after behavior, or relevant command. Link detailed reports.

## Testing Conventions

- Encapsulate every `.test-d.ts` assertion and expected compiler error in a named `test` inside a `describe` for the public function. Keep scenario-specific fixtures inside their tests; module scope is reserved for imports and shared type declarations.
- Group tests in a `describe` named after the public function under test, such as `describe('create')`. Keep scenario names inside that group and use separate groups for different entry functions. These groups exercise complete integration flows, not isolated function implementations.
- Runtime coverage is integration-only. Do not write unit tests, private-helper tests, or per-function suites disguised as integration tests.
- Colocate integration suites, benchmarks, and consumer type fixtures with their owning module: `Style.test.ts`, `Style.bench.ts`, and `Style.test-d.ts` beside `Style.ts`. Keep reusable input projects under `test/fixtures/`. Import public entrypoints and exercise real collaborating modules: authoring and validation, compilation and output, or host and consumer behavior.
- No mocking, stubbing, fake implementations, module replacements, fake timers, or stubbed globals. Use real compilers, temporary directories, processes, watchers, and browser/native engines. Fixture source and deterministic input data are allowed; replacement implementations are not.
- Verify web CSS through computed styles in a real browser, including cascade order, theme scopes, schemes, selectors, and queries. Do not use a simulated DOM as proof of browser behavior. Native checks use a real native engine and renderer when rendering is under test.
- Cover complete supported flows as they land: source to transformed module and CSS, packed-library consumption, watch recovery, and static native theme selection. Before a later stage exists, test the real available public boundary; do not fabricate a downstream stage.
- Exclude colocated tests, benchmarks, and type fixtures from published files and build outputs.
- Keep consumer type-contract fixtures alongside integration coverage. They validate inference and rejected inputs through public imports and do not replace runtime integration coverage.
- Snapshot values and results individually. Do not assemble unrelated values into an object or array solely to combine snapshot assertions. Snapshot an object or collection directly when it is the actual result under test; keep separate outputs and checks in separate assertions near the relevant operation.
- Assert observable runtime results and public diagnostics with inline snapshots (`toMatchInlineSnapshot` or `toThrowErrorMatchingInlineSnapshot`), not external snapshots or other assertion styles. Pass property matchers as the first argument to `toMatchInlineSnapshot` for genuinely nondeterministic fields, such as `expect.any(String)` or `expect.stringMatching(...)` for temporary paths. Keep deterministic values exact; never mask meaningful output. Review generated snapshots before accepting them. Compile-time `expectTypeOf` assertions and expected compiler errors remain in `.test-d.ts` fixtures. Never derive expected output from the implementation under test or treat a CSS snapshot alone as rendering proof.
- Report V8 coverage for production `src/` files from the existing integration run. Exclude tests and benchmarks; retain unimported source files. Publish an updating PR coverage comment and CI artifact. Coverage is diagnostic, not a reason to introduce unit tests or mock implementations.
- Add an integration regression scenario for every bug fix. Track coverage of consumer workflows and error paths rather than targeting a unit-test count or percentage.
- Use bounded waits for observable conditions, isolate real resources, and clean them up after success or failure. Do not hide flakes with arbitrary sleeps or retries.

- CSS mapping changes must update `test/conformance/coverage.json` and pass `pnpm check:css` plus the Transform CSS conformance scenarios. Review upstream grammar changes before refreshing fingerprints with `pnpm update:css`. Keep partial/deferred coverage explicit; preserve independent value checks, public type probes, and browser evidence.

## Benchmark Conventions

- Use the installed Vite Plus/Vitest benchmark runner: import `bench` and `describe` from `vite-plus/test` in colocated `*.bench.ts` files, and run `pnpm exec vp test bench --run --no-file-parallelism`. Keep benchmark APIs aligned with the lockfile.
- Benchmark real public workflows using the integration fixture corpus. No mocks, stubs, synthetic replacement compilers, or greeting benchmarks. Benchmark compilation, extraction, rewriting, and watch workloads as those stages land. Zyzz joins compiler comparisons when its real CSS emitter exists; do not benchmark authoring alone.
- Measure cold and warm compilation, incremental edits, throughput, memory, browser style recalculation, and native table selection separately. Use real browser/host timing for workloads outside the benchmark runner's execution model; do not substitute a function microbenchmark for end-to-end performance.
- Record emitted CSS, generated JavaScript, class-name/markup bytes, and required runtime helpers separately, plus actual combined transfer. Report raw, gzip, and Brotli sizes without double-counting class strings already included in JavaScript or markup. Package download size is a separate metric.
- Use repeated and mostly unique styles, small and large projects, theme/scheme changes, variants, and library boundaries. Validate equivalent behavior before comparing configurations or libraries; include each library's required helpers and delivery artifacts.
- Keep generated benchmark reports and machine metadata under ignored `bench/results/`; never commit them. Curated benchmark snapshots in documentation may be committed when tied to one run, commit, measurement scope, and uncertainty; preserve all comparison lanes and observed losses. A separate benchmark workflow calls Vite Plus directly and uploads artifacts; PR descriptions record relevant summaries. Comparisons against saved main artifacts must disclose separate runners and timing uncertainty. CI enforces configured gzip percentage-ratio thresholds with github-action-benchmark; comparisons across separate runners remain informational for timing. Confirm unexpected timing failures on the same machine. Keep definitions and reproduction instructions in Git.
- Save reproducible results with `--outputJson`; compare a baseline using `--compare`. Record commit, tool versions, fixture size, hardware, cache state, warmup, sample count, variance, and measurement boundaries. Run baseline and candidate on the same machine without competing benchmark jobs.
- Changes to compilation, emitted artifacts, or runtime helpers include relevant benchmark deltas. Establish size budgets and timing tolerances from measured baselines; confirm regressions across repeated samples instead of enforcing noisy single-run timing gates. Do not claim speed or size advantages without matched evidence.

## Workflow Conventions

- Use the smallest repository script that covers the changed behavior. Run focused tests while iterating.
- Run `pnpm check:types` after TypeScript changes.
- Use `pnpm test` for Vite Plus integration tests. Add compiler and renderer workflows only as those boundaries exist.
- `pnpm check` runs formatting, lint, and type checks with fixes. Inspect and keep only task-related changes.
- Run `git diff --check` and inspect the final diff before reporting completion.

## Git Conventions

- Conventional commits, lowercase, no trailing period: `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `test:`, `chore:`. Scope optional.
- Name the thing that changed, in the identifiers the codebase already uses. Prefer `feat: return annotation styles from Frame.render` over `feat: return the styles annotated markup needs`.
- State the change, not the reason for it. Leave `because`, `so that`, and `in order to` out of the subject.
- Write each message to stand alone for a reader who has not seen the pull request or the task that produced it.
- Keep the pull request title accurate as the branch grows: a squash merge makes it the message that lands on `main`, and the branch's own messages disappear.
- Never force push and never amend a pushed commit. Correct a mistake with a follow-up commit.

## UI Conventions

- Core and public style contracts do not depend on a UI framework or component library.
- Examples use the platform's normal class/style APIs and accessible native controls. Use an appropriate accessible primitive when an example needs coordinated behavior.
- Keep interaction, theme, viewport, and accessibility state in target or example adapters. Do not encode DOM selectors as universal native capabilities.
- Fonts and motion use the platform's normal mechanisms; examples must respect reduced-motion preferences.

## Repository Layout

- The repository implements the literal `Style.define` boundary with Vite Plus/zile tooling, integration/type coverage, and external compiler benchmarks. Later phases add compilation, source transforms, and component APIs.
- Add flat PascalCase modules under `src/`; colocate integration scenarios, consumer type fixtures, and benchmarks beside their owning modules. Keep reusable fixtures under `test/fixtures/` and benchmark instructions under `bench/`.
- Export stylesheet authoring functions as direct named leaf imports from `zyzz/web`, following `fontFace`, `global`, `keyframes`, and `layers`. Follow the accepted at-rule contract in `docs/api/web/at-rules.md`: dedicated functions own descriptor/statement rules; `global` owns selectors and grouping rules. Keep `Css` as the pure compiler namespace. New helpers remain planned until their implementation gates pass.
- Export the `css` and `variants` leaf functions directly and bind both on themes; conceptual modules use namespace exports. Infer variant props with standard `Parameters`, without a variant namespace.
- Every `css` definition is callable and returns props when applied. Callbacks receive only typed runtime values; no context helpers. Use trailing `!` for importance, arrays for fallbacks, and `theme.tokens`/`theme.vars` for references. Calls consume declared values and merge only styling overrides (`className`/`style` on web). Other component props stay on the component; unknown inputs are errors. Dynamic variant choices take typed callbacks and scoped payload selections; compound matches use choice names, while values bind to precompiled slots. Spread applied props; `cx` preserves bindings and recipe attributes. Generated functions never create CSS rules.
- Core semantics must be deterministic and independent of environments and tools; target emitters and host adapters have separate entrypoints.
- Expose platform APIs as named namespace exports: `Css` from `zyzz/web` and `StyleSheet` from `zyzz/react-native`. Keep shared `Style` definitions in the root entrypoint, independently of target namespaces.
- Add examples for web, native, and standalone distribution as their capabilities land.
- `.agents/plan.md` tracks phases and acceptance gates; `.agents/architecture.md` defines the target API.

## Tooling

- Prettier is banned. Use Vite Plus with oxfmt for formatting and oxlint for linting, configured in `vite.config.ts`.
- Use zile for library builds and development linking. Vite Plus is repository tooling, not a dependency of the styling core.
- Keep namespace exports, strict TypeScript settings, and source-first package entrypoints aligned with the zile scaffold.
- Put scripts, devDependencies, and packageManager before `[!start-pkg]` in package.json. Package metadata and runtime dependencies follow it. Preserve top-level package.json key order; alphabetize the entries within scripts.
- Use the single scaffold tsconfig.json. Zile derives build inputs from package entrypoints; do not add a separate build tsconfig.

## Commands

- `pnpm check` runs `vp check --fix`; use this single script for formatting, linting, and type checks.
- `pnpm check:types` runs TypeScript checking; `pnpm test` runs `vp test`.
- `pnpm exec vp test bench --run --no-file-parallelism` runs benchmarks; append `--outputJson <file>` to save results or `--compare <file>` to compare a baseline.
- `pnpm build` runs zile; `pnpm dev` runs `zile dev`.
