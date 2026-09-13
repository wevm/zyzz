# Compilation Benchmarks

## CI Scheduling

Compiler and React render benchmarks run on separate runners in parallel. Each job measures its baseline and candidate sequentially on the same runner. Sample counts, warmups, workloads, and performance gates are unchanged. Both artifacts feed one updating PR comment.

Integration tests use Vitest's numbered `--shard=i/3` partitions and merge their blob reports and V8 coverage. No module is assigned a dedicated runner. At-rule acceptance checks the merged report after the TypeScript matrix passes. Supplying `--results` verifies existing evidence without rerunning tests or types; standalone acceptance commands still run both.

TypeScript compatibility checks and JavaScript compiler instantiation benches run independently. Each attest version runs two sorted fixture partitions with `pnpm bench:types --shard i/2`; add `--list` to inspect a partition. Both compiler versions and both TypeScript 6.0 attest partitions remain required jobs. `pnpm check` runs formatting and syntax-only linting locally and in CI, with type-aware rules and compiler diagnostics disabled. Use `pnpm check:types` for explicit type checking. The TypeScript matrix checks types in CI, and property conformance owns the complete CSS inventory check.

## React Render and Mount Benchmarks

Run `pnpm bench:render` after installing Chromium with `pnpm exec playwright install chromium`. Run `node bench/RenderReport.ts bench/results` to report the raw samples in `bench/results/render-timings.json`. CI also measures the base source with the candidate harness on the same runner.

Vitest Browser Mode controls an isolated iframe containing an esbuild production React bundle. Framework applications use the official compiler adapters. React development mode, compilation, loading, test assertions, and protocol calls are outside timing. All frameworks render the same 100 or 1,000 cards with 10 or 100 distinct styles.

Each pass warms three cycles, then measures twenty fresh-root mounts, retained-DOM updates, and remounts after untimed removal. The second pass reverses framework order. Computed CSS is compared with independent native declarations after each operation; updates must preserve DOM identity and remounts must replace it.

| Metric          | Boundary                                                                           |
| --------------- | ---------------------------------------------------------------------------------- |
| Commit          | Scheduling through React rendering and DOM commit to a layout-effect checkpoint    |
| Commit + layout | Commit plus a forced geometry read, including pending style/layout work            |
| Frame           | Two animation frames after commit; includes refresh wait, not exact paint CPU time |

These measure warm-code client operations with styles already loaded. They do not measure cold navigation, hydration, GPU presentation, or isolated React CPU time. There is no forced synchronous React flush. Dynamic private slots currently compare only Zyzz and native CSS. Callable and override cases compare all six adapters; variant-recipe APIs need separate equivalent fixtures.

Render timings are the primary runtime report. Performance is advisory until repeated runs establish variance; missing data and correctness failures fail CI. Existing function timings cannot establish a render-performance ranking. Run the old browser diagnostics with `BENCH_RUNTIME=1 pnpm exec vp test run bench/Runtime.browser.test.ts`, or Node diagnostics with `BENCH_MICRO=1 pnpm exec vp test bench --run`.

## Runtime Comparisons

`bench/Runtime.bench.ts` measures production-compiled applications for Panda CSS, StyleX, Tailwind, vanilla-extract, and Zyzz, plus a plain class/style control. The shared partial-sharing corpus contains 10 or 100 distinct styles. Compilation, bundling, module initialization, and browser equivalence checks run outside timing.

| Case      | Measured application                                                              |
| --------- | --------------------------------------------------------------------------------- |
| cached    | Read precomputed props, including Zyzz's directly folded `css({...})()`           |
| callable  | Apply a surviving style callable or the framework's ordinary class/props API      |
| overrides | Apply styles with alternating external classes and inline color/padding overrides |

Inputs are preallocated; each timed iteration selects a style and retains the returned props in a shared result array. The same indexing and result-consumption overhead applies to every framework. Browser checks verify all styles and both override inputs against independent native declarations before collecting timings.

Client timings execute inside Chromium in two passes with reversed framework order. Each pass uses 100 batches after warmup, with batch calibration to amortize timer resolution. The browser version and raw samples are recorded in `browser-timings.json`. Node measurements remain separate diagnostics. Reports show nanoseconds per application, relative error, sample counts, and complete stylesheet/client transfer. Raw, gzip, and Brotli sizes and actual compiled artifacts are saved under `bench/results/runtime/`. Client bundles retain the helpers actually required by each framework.

```sh
pnpm exec playwright install chromium
pnpm exec vp test bench bench/Runtime.bench.ts --run --no-file-parallelism --outputJson bench/results/timings.json
BENCH_RUNTIME=1 pnpm exec vp test run bench/Runtime.browser.test.ts --no-file-parallelism
node bench/RuntimeReport.ts bench/results
pnpm test bench/Runtime.test.ts --run --no-file-parallelism
```

The diagnostic report includes every framework and observed loss. A competitor faster beyond reported uncertainty in both passes is reported without failing CI. Overlapping intervals are inconclusive, not evidence of a Zyzz win. The native control is informational; existing compiler/transfer gates remain unchanged.

These are browser JavaScript application measurements, not React rendering or layout timings. Tailwind, vanilla-extract, and the native control read class strings directly without per-style wrapper closures. The React suite above now covers mounts and changed-prop updates. Unchanged rerenders, allocation profiling, and packed consumption remain follow-ups. Variant comparisons must accompany the first variants implementation; this harness does not simulate an unavailable API.

The current Zyzz props helper includes override validation and inline-style copying. The benchmark measures that shipped behavior without removing checks or assigning competing frameworks artificial work. Runtime advantages must be established by measured results; cached class applications can have indistinguishable costs.

### Runtime Snapshot

Measured on Chromium 153.0.8010.12 in [run 34467564716](https://github.com/wevm/zyzz/actions/runs/34467564716), commit `f30a69c`, on the same Ubuntu runner. Values below span both passes of the 10-style workload, in nanoseconds per application. Each pass contains 100 calibrated batches after warmup; raw samples and browser identity are in the `runtime-benchmarks` artifact.

| Framework       | Cached props | Apply styles | Styling overrides |
| --------------- | -----------: | -----------: | ----------------: |
| Panda CSS       |    4.59–4.64 |      474–480 |           484–496 |
| StyleX          |    4.59–4.60 |    17.5–17.8 |         27.5–31.3 |
| Tailwind        |    4.58–4.59 |    9.87–9.95 |         16.6–16.7 |
| vanilla-extract |    4.59–4.60 |    9.85–10.0 |              18.9 |
| Zyzz            |    4.60–4.70 |    73.4–74.0 |           166–167 |

Cached results overlap across the two passes; no Zyzz advantage is established. Both callable and override results are slower than StyleX, Tailwind, and vanilla-extract beyond reported uncertainty in both passes, and faster than Panda. The 100-style workload has the same outcome. The historical function-only gate failed; that gate has since been replaced by render reporting.

Relative error for these application/override measurements is about 0.8–5.9%. These are browser JavaScript costs only, not component rendering, layout, or interaction latency. Zyzz's remaining override validation and style copying are optimization candidates; this run does not isolate their individual contributions.

Definitions live in `bench/Compilation.bench.ts` beside the compiler adapters, with shared workloads in `bench/Corpus.ts`. Run `pnpm exec vp test bench --run --no-file-parallelism --outputJson bench/results/timings.json`. Reports are ignored by Git.

The Benchmarks workflow uploads results and environment metadata as a 30-day artifact. One updating PR comment shows traffic-light deltas against a fresh main baseline measured sequentially on the same runner followed by the full framework comparison tables. Fork PRs receive Actions summaries and artifacts without comment writes. Missing baselines show “No baseline available.”

`BENCH_TIME_THRESHOLD: '110'` marks the 10% timing alert threshold; timing comparisons remain informational because one sequential pair does not eliminate measurement noise. `BENCH_SIZE_THRESHOLD: '105'` fails PR and manual checks above 5% gzip growth. Main pushes publish results without running a second benchmark suite or enforcing baseline regression thresholds.

The adapter supplies `customSmallerIsBetter` JSON and seeds the action's external data with the fresh main baseline. `save-data-file: false` preserves the baseline. The custom report combines comparisons against main and framework tables in the PR comment, Actions summary, and artifact. The action handles regression checks without posting duplicate comments.

PR runs benchmark the event's pinned main commit first, then the PR merge commit, using each checkout's locked dependencies. Manual runs compare main with the selected ref. Both runs record their environment and upload separate artifacts. This adds one benchmark pass to PR/manual jobs; baseline failures fail the job rather than silently skipping comparison.

Generate the report and action inputs locally:

```sh
node bench/Compare.ts bench/results /tmp/main-benchmarks /tmp/benchmark-action
```

For a comparison, measure baseline and candidate sequentially on the same idle machine with the same fixture corpus. Save the baseline outside the checkout, then append `--compare <baseline.json>` when running the candidate. Record variance and measurement limitations with any reported delta.

## Framework Gate

`node bench/Check.ts bench/results` requires Zyzz to beat Panda, StyleX, Tailwind, and vanilla-extract on every matched workload: eight literal cases and 10/100-component themes. Both `zyzz` and `zyzz-tokens` theme lanes must pass.

Each comparison requires strictly lower mean build time and strictly lower total gzip bytes (CSS plus required client JavaScript). Ties, missing competitors/workloads, invalid sizes, and unavailable timing samples fail. Raw/Brotli sizes and timing errors remain visible in the detailed report.

This gate runs on PRs, main pushes, and manual runs, using competitors measured in the same suite. It is independent of the existing baseline regression thresholds. Reports and artifacts publish before the job fails. Existing framework losses will make CI red until resolved; measured means can fluctuate near a tie.

## Compilation and Bundle Size

`bench/Compilation.bench.ts` compiles the same eight literal declarations for three components, 1,000 repeated components, and 1,000 components with unique padding. No reset, preset theme, responsive rules, or unused components are included. All components are retained in the browser bundle.

The adapters use [StyleX's Babel plugin and rule processor](https://stylexjs.com/docs/api/configuration/babel-plugin/), Tailwind's exported `compile(...).build(candidates)`, and [vanilla-extract's official esbuild plugin](https://vanilla-extract.style/documentation/integrations/esbuild/). Tailwind uses arbitrary-property utilities to preserve the exact literal input.

Each timing includes a compiler build and a minified browser bundle. Modules, filesystem caches, and esbuild are warm for in-process adapters. Fixture preparation, browser checks, compression, and report writes are outside timing. Tailwind content scanning is excluded; StyleX includes Babel parsing, and vanilla-extract includes source loading and evaluation.

All CSS passes through the same Lightning CSS final minifier with fixed Chrome 120, Firefox 128, and Safari 17 targets and source maps disabled. These are benchmark settings, not package support requirements. The lockfile pins the version, and every size report records the shared options. JavaScript bundling remains on esbuild. JSON reports under `bench/results/{small,repeated,unique}/` contain raw, gzip, and Brotli byte sizes for emitted CSS and client JavaScript, including required runtime helpers. Totals sum separately compressed delivery assets; class strings already in JavaScript are not counted again.

The workflow uploads generated CSS, JavaScript, timing reports, size reports, and host metadata. Its summary groups compiler timings and sizes by workload, with variance and additional size metrics in expandable details. The updating PR comment includes these tables and compares Zyzz against main. Fork PRs retain summaries and artifacts without requiring write access. `bench/Compilation.test.ts` checks equivalent computed declarations in real Chromium for repeated and unique inputs. Install the browser with `pnpm exec playwright install --only-shell chromium` before running tests locally.

Zyzz runs `Css.compile` from `zyzz/web` on prepared `Style.define` data, followed by shared Lightning CSS minification and esbuild browser bundling. Definition validation is outside timing, like Tailwind candidate preparation. Source extraction is measured separately; StyleX and vanilla-extract include their source pipelines. The component corpus uses `composition: 'independent'`: each class list is a complete application, so identical conflicting bodies can share rules. The default ordered mode preserves arbitrary generated-class combinations and is covered separately by A/B/A and shorthand browser tests. Independent mode does not promise that behavior; compositions must be resolved before compiling. No source rewriting or runtime composition helper is included in this literal workload. These fixtures do not establish whole-application or cross-library performance claims.

## Size Gate

The real browser integration corpus requires Zyzz's total CSS plus client JavaScript to be smaller than Panda CSS, StyleX, Tailwind, and vanilla-extract in raw, gzip, and Brotli bytes for all eight workloads. Each asset is compressed independently. All compilers use the same retained components and minification settings. The gate runs alongside computed-style equivalence and does not alter the StyleX adapter.

The optimization target is smaller CSS and total delivery across every library and workload, with lower compilation time. The report retains losses. Existing StyleX gates remain enforced; noisy timing samples must not become strict winner assertions. Broader selectors, themes, variants, and application workloads must earn their budgets as they are implemented.

## Expanded Corpus and Prior Art

The corpus adapts benchmark ideas, without copying third-party implementation code:

- [StyleX](https://github.com/facebook/stylex/tree/main/packages/benchmarks) separates basic/complex transforms, themes, and emitted sizes. The literal corpus now exercises partial sharing, palette reuse, independent values, and sparse properties.
- [TypeStyles' vanilla-extract reference app](https://github.com/type-styles/typestyles/blob/main/docs/content/docs/benchmarks.md) motivates the component mix: buttons, rows, grids, text, inputs, and cards. Our 60-style literal fixture is independently authored and intentionally excludes unsupported themes/recipes.
- [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4) motivates separate cold, new-CSS, and no-new-CSS build paths; these await source/watch adapters.
- [Emotion](https://github.com/emotion-js/emotion/tree/main/scripts/benchmarks), [styled-components](https://github.com/styled-components/styled-components/tree/main/packages/benchmarks), [Stitches](https://stitches.dev/docs/benchmarks), and [Tamagui](https://tamagui.dev/docs/intro/benchmarks) motivate deep/wide mounting, prop updates, and dynamic cardinality. These await the corresponding Zyzz component APIs.
- [css-in-js-bench](https://github.com/jantimon/css-in-js-bench) motivates shared inputs, production payloads, SSR/hydration, and independent browser parity checks.

`Corpus.ts` defines eight workloads. All workloads are transfer-size-gated against all comparison libraries. Five expanded workloads cover partial sharing, a 16-value palette, independently varying fields, sparse property sets, and mixed component shapes. Values use fixed integer mixing, not random seeds or clocks. All cases publish every result, including losses; each reported asset metric remains visible even when total transfer wins.

Every compiler renders against browser-interpreted literal CSS, rather than another compiler's output. Checks cover the union of authored properties and style count. Declaration counts are measured from each fixture instead of assuming eight per component.

## Additional Compiler Adapters

Panda CSS uses `@pandacss/node` config loading, code generation, source extraction, and CSS emission, followed by the common esbuild browser bundler. The base utility preset is enabled, the design-token preset and preflight are disabled, and required generated helpers and base CSS are retained. Generated `.mjs` modules use normal esbuild resolution.

The Actions summary groups all five compilers by workload. Short CI samples are regression signals, not precise speed rankings; retain sample counts and error bars and run longer quiet-machine measurements before making latency claims. No other styling libraries are added.

## Emitter Optimizations

Zyzz uses compact authored class names and sorted base identifiers scoped to the complete compilation. Declaration validation and serialization are cached per invocation. Domain analysis retains only the first sequence and a conflict flag; it does not retain every distinct value. Cascade order and repeated A/B/A overrides remain unchanged.

Remaining targets include palette/component reuse without changing cascade semantics, sparse-style factoring costs, and independent-value compression. A CSS-only win, total-transfer win, and timing win are distinct results. No universal lead is claimed until each is measured. Tamagui is excluded from the PR benchmark matrix because its extraction cost dominates CI time.

## Final Processing Boundary

The final minifier is a benchmark dependency only; core compilation remains unchanged. Compiler-specific upstream processing remains intact: vanilla-extract uses its esbuild integration with minification enabled, StyleX processes extracted rules, Panda runs its code-generation/CSS pipeline, and Tailwind builds utilities. Shared final processing does not make these pipelines identical. Its cost remains included in build timings.

Browser checks consume the final processed CSS for every corpus case. A separate public authoring-to-emission-to-minification browser scenario verifies combined classes, shorthand precedence, and A/B/A overrides. Existing transfer gates remain unchanged.

Lightning CSS preserves license comments, which are counted in the emitted CSS sizes. The previous esbuild final pass removed legal comments; before/after figures therefore measure the full processing change, including comment retention and fixed target lowering. No adapter strips comments or applies a library-specific final optimization.

## Source Extraction Pipeline

`src/compiler/Source.bench.ts` measures real parsing, lexical binding analysis, literal validation, and CSS emission for 10, 100, and 1,000 source definitions. Source text preparation is outside timing. Module rewriting, final minification, and browser bundling are excluded. The Actions summary groups these measurements separately from compiler comparisons; they are not interchangeable speed rankings or full application bundle measurements.

Benchmark files run sequentially so extraction measurements do not compete with the compiler comparison suite. Integration-test parallelism is unchanged.

Fixture projects have a fixed package name and relative source filename inside isolated temporary directories. Vanilla-extract runs with that project as its working directory so random temporary paths do not change generated identifiers or compressed byte counts. Its official short identifier mode is retained.

## Module Transforms and Props Binding

`src/compiler/Transform.bench.ts` measures parsing, binding analysis, validation, ordered CSS emission, module rewriting, and both source maps for 10/100/1,000 exported literal definitions. File loading, final minification, and browser bundling are outside the timing. This is a broader pipeline than the independent in-memory comparison matrix and does not establish cross-library winners.

A separate local-theme group uses the same counts with one literal color token, two compatible scalar scopes, and bound style calls. It includes factory extraction, token-name resolution, stable identities, scope constants, and maps. Literal and theme records use separate filenames and summary tables. This group does not include imported theme linking or replace the existing matched cross-library theme comparisons.

Transform timing uses at least 30 samples and one second of measurement after at least 10 warmup iterations and 500 milliseconds. Baseline comparisons must use those same settings; the earlier three-sample windows are too noisy for large-module regression decisions.

Setup records final CSS and bundled JavaScript under `bench/results/transform`, including the required `zyzz/runtime` props helper. CSS uses the existing shared Lightning CSS settings. JavaScript uses esbuild minification. Raw, gzip, and Brotli totals include both delivery assets; map bytes are recorded separately. Maps are not silently included in or subtracted from browser transfer.

`src/runtime/Props.bench.ts` measures the actual generated-callable helper with no overrides and with class/style overrides. Creation happens outside timing; the measured operation validates inputs and returns props without generating rules. These are JavaScript binding costs, not browser rendering or framework rerender measurements.

## Type Instantiations

Colocated `src/**/*.bench-d.ts` fixtures measure the TypeScript instantiations contributed by public authoring, compiler, runtime, host, and Vite calls with `@ark/attest`. Each fixture declares its public values from type-only entrypoint imports, warms shared contracts in an exported module-scope `baseline` function, and snapshots each bench body inline. Attest strips the bench statements from the file, type-checks that baseline once, then type-checks the file with each body appended and reports the difference in instantiations. Bench bodies never execute.

`pnpm bench:types` runs every fixture in one process against the installed `typescript` package and fails when a body exceeds its baseline by more than 20%. `pnpm update:types` rewrites the inline baselines after an intentional contract change. Counts are deterministic for one compiler release and can differ between releases, so establish baselines under the pinned version. Check time and memory are not part of these benches; `tsc --extendedDiagnostics` reports them in the TypeScript workflow matrix.

The Verify workflow runs type checks for TypeScript 6.0 and 7.0, and instantiation benches for TypeScript 6.0. JavaScript releases replace the pinned `typescript` package so attest and repository scripts import the version under test. The native 7.x package ships no compiler API, which `scripts/binding-domains.ts` and `test/fixtures/Library.ts` import, so that lane installs it beside the pinned package under an alias, runs only its `tsc` binary, and reports whole-program diagnostics without per-bench counts.

## File Host

`src/node/Host.bench.ts` measures 100 literal styles in one source module. Cold-process rebuilds include Node startup, compiler loading, source reading, compilation, ownership checks, and closing a new host against an existing output directory. Driver bundling and fixture creation are outside timing. Unchanged rebuilds reuse an open host and its source cache while still reading files and validating output ownership.

Watch edits measure from the real source write through filesystem notification, recompilation, and successful artifact publication. Warmup/setup output is excluded; samples use distinct changed values. These host measurements are separate from in-memory library comparisons and do not claim cross-library wins. Raw/gzip/Brotli source-transform delivery remains in the module-transform report because the host writes those same artifacts without another compiler or minifier.

Watch benchmark waits have a five-second deadline. Real host errors and source-write failures reject the pending sample; failed initial setup closes its watcher. Integration tests exercise both source-error recovery and a deadline with no source edit through the same notification fixture.

Theme compilation measures 10 and 100 named styles with two compatible scopes and color-scheme pairs. Timing covers in-memory CSS emission from prevalidated definitions; emitted raw/gzip/Brotli CSS is reported before final minification. It excludes source extraction, JavaScript generation, and browser rendering. This pure-emitter baseline is separate from the matched theme-delivery comparison.

## Theme Comparisons

`Themes.bench.ts` compares 10 and 100 distinct component widths under two complete theme scopes. Each theme defines background, foreground, and spacing; colors use equivalent `light-dark()` values. Browser integration checks both scopes, nested restoration of the base theme, forced/system schemes, and changing the selected scope without changing component classes.

Adapters use [Panda named semantic-token themes](https://panda-css.com/blog/building-a-multi-brand-design-system-with-panda-css), [StyleX variables and createTheme](https://stylexjs.com/docs/learn/theming/creating-themes), [Tailwind theme variables and ordinary scoped CSS](https://tailwindcss.com/docs/theme), and [vanilla-extract theme contracts](https://vanilla-extract.style/documentation/api/create-theme-contract/). Zyzz uses `Theme.define`/`Theme.extend` and its independent in-memory emitter. Every theme adapter uses shared Lightning CSS final processing targeting Chrome 123, Firefox 128, and Safari 17.5, retaining native `light-dark()` and external/inline `color-scheme` selection. The literal matrix retains its previous targets. Each adapter bundles actual component classes and scope exports; required helpers and default token rules are retained.

Timing boundaries differ: fixture writes are excluded; Panda includes config loading/code generation/extraction, StyleX includes both source modules through the official Babel plugin, vanilla-extract includes its esbuild integration, Tailwind starts with prepared candidates, the `zyzz` lane starts with validated explicit references, and `zyzz-tokens` starts with unresolved named-token style data and includes `Style.define` validation/resolution inside each timed call. All include final processing and browser bundling. Both Zyzz lanes appear alongside all four competitors in the Actions summary. Integration tests require byte-identical CSS and JavaScript from the two Zyzz lanes and computed-style parity across every lane. These measurements do not establish equal source-pipeline throughput. Theme source parsing, framework mount/rerender cost, and theme-switch latency remain separate future workloads.

Report CSS, client JavaScript, and their combined raw/gzip/Brotli transfer without recounting class strings already present in JavaScript. Keep all libraries and observed gaps visible. Existing literal transfer gates remain unchanged; theme budgets require matched measurements and browser parity before becoming regression gates.

### Target Configuration

Pass a shared target map when preparing a fixture:

```ts
const fixture = await Themes.create(100, {
  targets: { chrome: 123 << 16, safari: (17 << 16) | (5 << 8) },
})
```

`Compilation.create(workload, { targets })` supports the same option. Every library receives a frozen copy of the profile for final CSS processing; result artifacts record it. Omitting the option retains the existing CI baseline. Changing a benchmark profile does not change package browser requirements or another workload's settings.

Custom target profiles must retain native `light-dark()`. Fixture creation rejects profiles that Lightning CSS would lower, before preparing or timing any library. The profile-propagation integration test verifies supported overrides through every real compiler; Chromium scenarios validate inherited, nested, and inline scheme selection.

## Packed Theme Contracts

`src/compiler/Graph.bench.ts` includes 10/100-style consumers compiled from serialized library contracts. Timings include JSON validation, linking, extraction, CSS emission, rewriting, and maps; package building and filesystem resolution are outside this lane. Existing source-graph timings now include contract serialization.

Contract sidecars are compiler inputs, not client JavaScript. Imported contracts retain complete token scopes so app extensions can style independently compiled library components. This can retain more CSS than closed-graph token liveness; report that cost separately from metadata download size.

Benchmarks without timing samples are marked unavailable in reports and excluded from timing-action input. Their absence does not become a zero-duration result or suppress valid framework/size measurements. Pull requests compare with their base commit, including stacked PRs.

## Logical Boxes

`Transform.bench.ts` includes 10/100 additional logical-box styles with mixed axes, token references, fallbacks, and importance. Timings cover extraction, emission, rewriting, and maps. Setup separately records minified CSS, bundled client JavaScript, map sizes, and combined raw/gzip/Brotli transfer under `bench/results/transform/logical-*.json`. Browser fixtures compare native logical CSS across writing modes and verify ordered physical/logical conflicts.

## Flex Layout and Overflow

`Transform.bench.ts` includes 10/100 additional flex styles with token sizing, integer order, alignment, and overflow fallbacks. Timings cover the complete source pipeline; setup records CSS, bundled JavaScript, maps, and combined raw/gzip/Brotli delivery under `bench/results/transform/flex-*.json`. Browser fixtures compare native flex layout and distinguish clipping from scrolling.

## Borders and Outlines

`Transform.bench.ts` includes 10/100 additional border styles with logical/physical conflicts, corners, outlines, token colors/radii, and important fallbacks. Timings cover the source pipeline; setup records CSS, bundled JavaScript, maps, and combined raw/gzip/Brotli transfer in `bench/results/transform/borders-*.json`. Browser fixtures compare every added property with native CSS and verify repeated whole-border overrides.

## Intrinsic Sizing

`Transform.bench.ts` measures 10/100 additional intrinsic sizing styles with minimum/maximum constraints, flex content, and important fallbacks. Setup writes CSS, bundled JavaScript, maps, and combined raw/gzip/Brotli delivery to `bench/results/transform/sizing-*.json`. Browser fixtures verify min/max/fit-content widths and the distinction between content and auto flex basis.

## Scroll Spacing

`Transform.bench.ts` adds 10/100-style scrolling workloads with physical/logical scroll offsets, spacing-token padding, ordered fallbacks, importance, and scroll/overscroll behavior. The shared fixture also exercises source maps and real browser scroll-into-view alignment.

Run `pnpm exec vp test bench src/compiler/Transform.bench.ts --run --no-file-parallelism -t 'scroll spacing transform' --outputJson bench/results/scrolling.json`. Delivery reports under `bench/results/transform/scrolling-*.json` separate CSS, bundled JavaScript, maps, and combined raw/gzip/Brotli transfer. Device gesture latency and smooth-scroll duration are not compiler timings.

## Scroll Snapping

`Transform.bench.ts` adds 10/100-style snap workloads with axis/strictness pairs, paired alignment, stop behavior, ordered fallbacks, and importance. The shared source fixture includes themed scroll padding; browser integration compares snap positions and always-stop behavior with native CSS controls.

Run `pnpm exec vp test bench src/compiler/Transform.bench.ts --run --no-file-parallelism -t 'scroll snap transform' --outputJson bench/results/snapping.json`. Reports under `bench/results/transform/snapping-*.json` separate CSS, bundled JavaScript, maps, and combined raw/gzip/Brotli transfer. Browser snap physics are not part of compiler timing.

## Text Flow

`Transform.bench.ts` adds 10/100-style text workloads with indentation, letter-spacing fallbacks, wrapping, and text overflow. The shared source fixture covers indentation tokens and browser comparisons for wrapping, spacing, and overflow.

Run `pnpm exec vp test bench src/compiler/Transform.bench.ts --run --no-file-parallelism -t 'text flow transform' --outputJson bench/results/text-flow.json`. Reports under `bench/results/transform/text-*.json` separate CSS, bundled JavaScript, maps, and combined raw/gzip/Brotli transfer. Font shaping and browser layout time remain separate from compiler timing.

## Text Decorations

`Transform.bench.ts` adds 10/100-style decoration workloads with line combinations, style, thickness, underline offsets, and important fallbacks. The shared source fixture includes shared color and spacing tokens; browser integration compares computed declarations with independent CSS controls across writing modes and directions.

Run `pnpm exec vp test bench src/compiler/Transform.bench.ts --run --no-file-parallelism -t 'text decoration transform' --outputJson bench/results/decoration.json`. Reports under `bench/results/transform/decoration-*.json` separate CSS, bundled JavaScript, maps, and combined raw/gzip/Brotli transfer. Decoration painting is outside compiler timing.

## Runtime specialization experiment

The candidate harness also runs against the PR base source on the same runner,
with the same installed dependencies and Chromium. `runtime-base/commit.txt`
records that source revision. Its output is retained beside candidate results.
The historical snapshot above predates validation removal; it is not the baseline
for this experiment.

`direct` uses a switch containing statically known application sites for every
framework. `callable` dispatches surviving callables (or class strings where that
is the framework API). Both allocate fresh props. `overrides` forwards immutable
inline styles, and Zyzz now shares the supplied style object. `dynamic` compares
two changing scalar slots against a native class/custom-property control; it does
not yet compare dynamic APIs from other frameworks. Browser verification checks
each update before timing. No React rendering or DOM updates are timed.

Local static definitions fold only when every reference is a direct no-argument
call. Exports, escapes, mutation, shadowing, optional calls, and overrides retain
the callable. Generated dynamic functions read fixed slots directly, then return
one props object and one style object with private variables taking precedence.

### Paired optimization results — 2026-09-10

[Chromium run 34470931898](https://github.com/wevm/zyzz/actions/runs/34470931898)
measured main `8cca490e42b16fd3c213d1a4ef115403e393656d` against PR head
`df54ef66fef41d9cee8d642926c6bae5958d963a` (tested merge
`b6749ac58bcabc6ded86410ea27375b3ef6c61cb`). Chromium was 153.0.8010.12.
Each cell below gives the two pass means as a range, in nanoseconds per application;
these ranges are not confidence intervals. The
[runtime artifact](https://github.com/wevm/zyzz/actions/runs/34470931898/artifacts/10149747652)
contains all 100 samples per pass, relative error, environment, and delivery sizes.

| Styles | Application |     Main (ns) | Optimized (ns) |
| ------ | ----------- | ------------: | -------------: |
| 10     | Direct      |   19.78–19.81 |    14.19–17.67 |
| 100    | Direct      |   33.57–34.79 |    21.94–22.89 |
| 10     | Callable    |   18.07–18.08 |    10.88–10.99 |
| 100    | Callable    |   17.46–17.55 |    11.09–11.18 |
| 10     | Overrides   |   50.17–50.69 |    20.63–20.66 |
| 100    | Overrides   |   48.74–49.80 |    20.57–20.61 |
| 10     | Dynamic     | 651.37–656.25 |    31.49–32.47 |
| 100    | Dynamic     | 667.97–670.90 |    45.53–46.39 |

Cached props remain around 4 ns. Optimized callables and overrides beat StyleX
and Panda in both passes, but Tailwind and vanilla-extract remain faster:
roughly 9 ns for their direct class-string application versus Zyzz's 11 ns;
15–18 ns for overrides versus Zyzz's 21 ns. The historical function-only gate stayed red; that gate has since been replaced by render reporting.
The direct-switch workload is noisy at 10 styles and inconclusive against the
other static frameworks at 100 styles. Dynamic matches the native control within
uncertainty at 10 styles; at 100, the control remains around 31 ns.

The removed work is concrete: static no-argument calls allocate one props object;
unchanged overrides avoid style copies; compiled dynamic calls avoid slot
enumeration and intermediate binding/merge objects. Surviving static calls still
perform callable dispatch and support optional overrides, while the native class
paths read a string. The dynamic scaling difference may involve dispatch across
many generated functions and distinct private-property shapes; profiling is
needed before attributing the remaining difference to either.

Inlining has a delivery tradeoff. At 100 styles, direct-call JavaScript gzip grows
from 1,655 to 2,320 bytes; dynamic JavaScript grows from 1,775 to 1,869 bytes.
Callable JavaScript is unchanged at 1,376 bytes. Initialization guards and fresh
props identity are retained; no shared result cache is introduced.

### Compiler analysis follow-up

The paired CI report also flagged advisory transform-time regressions (for
example, 46.76 → 54.69 ms at 1,000 exported styles). The first implementation
performed another AST walk even when no local definition could be folded.
The follow-up gathers relevant references during the transform's existing walk
and skips reference analysis when there are no eligible definitions.

A local Node v24.19.0 comparison ran main, the extra-walk implementation, and the
shared-walk implementation in reversed order across two passes, with 10 warmups
and 30 samples each. At 1,000 exported styles, the pass means were 103.36–105.10 ms
(main), 119.57–146.01 ms (extra walk), and 109.79–110.01 ms (shared walk).
The shared-walk and main error intervals overlap; smaller workloads were noisier.
These absolute times are not comparable to the GitHub runner. The comparison
also verified identical JavaScript, CSS, and source maps before/after the
refactor for exported and local applications at 100 and 1,000 styles.
The final CI rerun remains the check on this compile-time follow-up.

## Conditional Recipes

Run the static and three-condition recipe workflows together:

```sh
pnpm exec vp test bench --run src/variants.conditions.bench.ts --no-file-parallelism --outputJson bench/results/conditional-recipes.json
```

Compilation includes source extraction and CSS/JavaScript rewriting. Selection uses the helpers chosen by the real compiler, with defaults and conditional overrides measured separately. These microbenchmarks do not measure framework rendering or browser style recalculation. Run without competing benchmark jobs; retain the sample counts and variance from the report.

Dynamic recipe payloads have a separate diagnostic benchmark:

```sh
pnpm exec vp test bench src/variants.payloads.bench.ts --run
pnpm bench:types --fixture variants.payloads
```

Payload values bind fixed slots; changing values does not increase stylesheet rules. Save benchmark output with `--outputJson bench/results/payload-recipes.json` and retain run metadata before publishing timing comparisons.

Runtime composition benchmarks execute generated modules for both output shapes:

```sh
pnpm exec vp test bench src/cx.runtime.bench.ts --run --outputJson bench/results/runtime-composition.json
```

Conditional presence emits bounded static groups; runtime calls never add rules. Retain run metadata and variance before publishing timing comparisons.

## Immutable composition bindings

Measured source: `e20e5226eb34b81fe9f1d1150573bdd5fb201737` (`src/cx.bindings.bench.ts`).

Run: 2026-09-13T13:04:33.464Z; AMD EPYC 9V74 80-Core Processor, linux x64, Node v24.19.0, esbuild 0.28.2, vite-plus 0.2.2 / Vitest 4.1.9. Each benchmark used 100 ms warmup and 250 ms measurement. Compilation is warm and in-process; application excludes module initialization. This shared-host diagnostic run is not a performance guarantee.

| Workload     | JS bytes (gzip) | CSS bytes (gzip) | Compile mean ms (RME, samples) | Apply mean µs (RME, samples) |
| ------------ | --------------- | ---------------- | ------------------------------ | ---------------------------- |
| react direct | 522 (325)       | 146 (95)         | 0.5938 (3.91%, 422)            | 0.0467 (0.62%, 5353406)      |
| react bound  | 1534 (733)      | 146 (96)         | 0.6831 (7.16%, 366)            | 0.9116 (1.60%, 274253)       |
| html direct  | 1217 (681)      | 146 (95)         | 0.5529 (3.74%, 453)            | 0.0586 (2.55%, 4266568)      |
| html bound   | 2076 (969)      | 146 (96)         | 0.5979 (4.03%, 419)            | 1.7701 (2.69%, 141236)       |

Binding props retains a runtime merge: React adds 1,012 raw / 408 gzip JavaScript bytes; HTML adds 859 raw / 288 gzip bytes. CSS stays 146 bytes (gzip differs by one byte because of generated identifiers). The table records the associated per-call and compile-time costs against the matching direct composition. Initialization cost is excluded and has not been measured.

Reproduce from that commit:

```sh
pnpm exec vp test bench src/cx.bindings.bench.ts --run --outputJson bench/results/composition-bindings.json
```

The benchmark also writes `bench/results/composition-bindings-metadata.json`, including SHA-256 hashes of the exact workload sources, renderer, tool versions, measurement window, and emitted sizes. Both generated reports remain ignored.
