# Compilation Benchmarks

Definitions live in `bench/Compilation.bench.ts` beside the compiler adapters, with shared workloads in `bench/Corpus.ts`. Run `pnpm exec vp test bench --run --no-file-parallelism --outputJson bench/results/timings.json`. Reports are ignored by Git.

The Benchmarks workflow uploads results and environment metadata as a 30-day artifact. One updating PR comment shows traffic-light deltas against a fresh main baseline measured sequentially on the same runner followed by the full framework comparison tables. Fork PRs receive Actions summaries and artifacts without comment writes. Missing baselines show “No baseline available.”

`BENCH_TIME_THRESHOLD: '110'` marks the 10% timing alert threshold; timing comparisons remain informational because one sequential pair does not eliminate measurement noise. `BENCH_SIZE_THRESHOLD: '105'` fails PR and manual checks above 5% gzip growth. Main pushes publish results without running a second benchmark suite or enforcing thresholds.

The adapter supplies `customSmallerIsBetter` JSON and seeds the action's external data with the fresh main baseline. `save-data-file: false` preserves the baseline. The custom report combines comparisons against main and framework tables in the PR comment, Actions summary, and artifact. The action handles regression checks without posting duplicate comments.

PR runs benchmark the event's pinned main commit first, then the PR merge commit, using each checkout's locked dependencies. Manual runs compare main with the selected ref. Both runs record their environment and upload separate artifacts. This adds one benchmark pass to PR/manual jobs; baseline failures fail the job rather than silently skipping comparison.

Generate the report and action inputs locally:

```sh
node bench/Compare.ts bench/results /tmp/main-benchmarks /tmp/benchmark-action
```

For a comparison, measure baseline and candidate sequentially on the same idle machine with the same fixture corpus. Save the baseline outside the checkout, then append `--compare <baseline.json>` when running the candidate. Record variance and measurement limitations with any reported delta.

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
