# Benchmarks

Compiler, runtime, React render, theme, and type-instantiation benchmarks, with comparison adapters for Panda CSS, StyleX, Tailwind, and vanilla-extract. Comparison workloads are defined in `Corpus.ts`; pipeline benchmarks live beside their modules as `src/**/*.bench.ts`. Reports are written under the ignored `bench/results/` directory.

Zyzz comparison lanes use `cssOutput: 'grouped'`. Atomic output stays the application default and keeps its browser correctness coverage.

## Commands

Install Chromium once with `pnpm exec playwright install chromium`.

| Command                                                                                       | Measures                                                                    |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm exec vp test bench --run --no-file-parallelism --outputJson bench/results/timings.json` | Every colocated benchmark: compiler comparisons and pipeline stages         |
| `pnpm build && pnpm bench:check`                                                              | Benchmark fixture correctness in Chromium, plus grouped Next.js comparisons |
| `pnpm bench:render`                                                                           | Production React mount, update, and remount timings in Chromium             |
| `pnpm bench:types`                                                                            | TypeScript instantiation benches with `@ark/attest`                         |
| `pnpm update:types`                                                                           | Rewrites inline type-bench baselines after an intentional contract change   |
| `node bench/Check.ts bench/results`                                                           | Framework gate over saved results                                           |
| `node bench/Compare.ts bench/results <baseline> <action-input>`                               | Baseline comparison report and action input                                 |

Append `--compare <baseline.json>` to a benchmark run to compare against a saved baseline. Measure baseline and candidate sequentially on the same idle machine, save the baseline outside the checkout, and record variance with any reported delta.

Diagnostic runs:

```sh
BENCH_RUNTIME=1 pnpm exec vp test run --config bench/Check.config.ts bench/Runtime.test.ts --no-file-parallelism
BENCH_MICRO=1 pnpm exec vp test bench --run
node bench/RuntimeReport.ts bench/results
node bench/RenderReport.ts bench/results
```

## CI

The Benchmarks workflow runs four parallel jobs: fixture checks with Next.js comparisons, compiler benchmarks, React renders, and type benches. Compiler and render jobs measure a fresh main baseline, then the candidate, sequentially on the same runner. Both feed one updating PR comment with traffic-light deltas followed by the framework tables. Fork PRs receive Actions summaries and artifacts without comment writes; missing baselines show “No baseline available.”

PR runs benchmark the event's pinned main commit first, then the PR merge commit, using each checkout's locked dependencies. Manual runs compare main with the selected ref. Baseline failures fail the job. Results and environment metadata upload as 30-day artifacts.

| Gate                        | Rule                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `BENCH_SIZE_THRESHOLD: 105` | Fails PR and manual runs above 5% gzip growth against main                                       |
| `BENCH_TIME_THRESHOLD: 110` | Marks timing deltas above 10%; informational, since one sequential pair does not remove noise    |
| Framework gate              | Zyzz must beat every competitor on build time and total gzip for all matched workloads           |
| Size gate                   | Zyzz CSS plus client JavaScript must be smaller in raw, gzip, and Brotli bytes for all workloads |

Main pushes publish results without a second suite or baseline thresholds. Reports and artifacts publish before a gate fails. Measured means near a tie can fluctuate; the framework gate treats ties, missing lanes, invalid sizes, and unavailable samples as failures.

The Verify workflow runs application correctness tests and TypeScript checks separately. Integration tests use `--shard=i/3` partitions with merged blob reports and V8 coverage. Type benches run per attest version in two sorted partitions with `pnpm bench:types --shard i/2`; `--list` prints a partition.

## Compilation and Bundle Size

`Compilation.bench.ts` compiles eight literal workloads: three components, 1,000 repeated components, 1,000 components with unique padding, and five expanded workloads covering partial sharing, a 16-value palette, independently varying fields, sparse properties, and mixed component shapes. Values use fixed integer mixing. All components stay in the browser bundle; no reset, preset theme, responsive rules, or unused components are included.

Adapters use [StyleX's Babel plugin and rule processor](https://stylexjs.com/docs/api/configuration/babel-plugin/), Tailwind's `compile(...).build(candidates)` with arbitrary-property utilities, [vanilla-extract's esbuild plugin](https://vanilla-extract.style/documentation/integrations/esbuild/), and Panda's `@pandacss/node` config loading, code generation, extraction, and emission with the base utility preset and preflight disabled. Zyzz runs `Css.compile` from `zyzz/web` on prepared `Style.define` data with `composition: 'independent'`.

Timing boundaries:

- Each sample includes a compiler build and a minified esbuild browser bundle. Modules, filesystem caches, and esbuild are warm.
- Fixture preparation, browser checks, compression, and report writes are outside timing.
- Tailwind excludes content scanning; StyleX includes Babel parsing; vanilla-extract includes source loading and evaluation; Zyzz excludes definition validation.

All CSS passes through the same Lightning CSS minifier targeting Chrome 120, Firefox 128, and Safari 17, with source maps disabled. These are benchmark settings, not package support requirements. License comments count toward CSS size; no adapter strips them. Reports under `bench/results/{small,repeated,unique}/` record raw, gzip, and Brotli bytes for CSS and client JavaScript, including required runtime helpers. Totals sum separately compressed assets without recounting class strings already in JavaScript.

`Compilation.test.ts` checks computed declarations in Chromium against browser-interpreted literal CSS for every workload. Independent composition lets identical conflicting bodies share rules; the default ordered mode is covered separately by A/B/A and shorthand browser tests.

## Theme Comparisons

`Themes.bench.ts` compares 10 and 100 component widths under two complete theme scopes with `light-dark()` colors. Adapters use [Panda semantic-token themes](https://panda-css.com/blog/building-a-multi-brand-design-system-with-panda-css), [StyleX variables and createTheme](https://stylexjs.com/docs/learn/theming/creating-themes), [Tailwind theme variables](https://tailwindcss.com/docs/theme), and [vanilla-extract theme contracts](https://vanilla-extract.style/documentation/api/create-theme-contract/). The `zyzz` lane starts from validated explicit references; `zyzz-tokens` starts from named-token style data and includes `Style.define` resolution in each sample. Both lanes must produce byte-identical CSS and JavaScript.

Theme CSS targets Chrome 123, Firefox 128, and Safari 17.5, retaining native `light-dark()` and `color-scheme` selection. Browser checks cover both scopes, nested restoration of the base theme, forced and system schemes, and switching scopes without changing component classes.

Pass a shared target map to a fixture; every library receives a frozen copy, and result artifacts record it:

```ts
const fixture = await Themes.create(100, {
  targets: { chrome: 123 << 16, safari: (17 << 16) | (5 << 8) },
})
```

`Compilation.create(workload, { targets })` accepts the same option. Fixture creation rejects profiles that Lightning CSS would lower away from native `light-dark()`.

## Runtime Comparisons

`Runtime.bench.ts` measures production-compiled applications for all five libraries plus a plain class/style control, over 10 or 100 distinct styles. Compilation, bundling, module initialization, and browser equivalence checks run outside timing.

| Case      | Measured application                                                              |
| --------- | --------------------------------------------------------------------------------- |
| cached    | Read precomputed props, including Zyzz's directly folded `style({...})()`         |
| direct    | Switch over statically known application sites                                    |
| callable  | Apply a surviving style callable or the framework's class/props API               |
| overrides | Apply styles with alternating external classes and inline color/padding overrides |
| dynamic   | Bind two changing scalar slots, compared with a native custom-property control    |

Inputs are preallocated; each iteration selects a style and retains the returned props. Chromium runs two passes with reversed framework order, each with 100 calibrated batches after warmup. Reports show nanoseconds per application, relative error, sample counts, and stylesheet plus client transfer. Browser identity and raw samples are saved in `browser-timings.json`; artifacts under `bench/results/runtime/`.

A competitor faster beyond reported uncertainty in both passes is reported without failing CI. Overlapping intervals are inconclusive. These are JavaScript application costs, not rendering or layout timings. Tailwind, vanilla-extract, and the control read class strings directly without per-style closures.

### Recorded Results

[Run 34470931898](https://github.com/wevm/zyzz/actions/runs/34470931898) on 2026-09-10 measured main `8cca490` against PR head `df54ef6` on Chromium 153.0.8010.12. Cells give the two pass means as a range in nanoseconds per application; these are not confidence intervals. The [runtime artifact](https://github.com/wevm/zyzz/actions/runs/34470931898/artifacts/10149747652) holds all samples, relative error, environment, and sizes.

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

Cached props stay around 4 ns for every framework. Optimized callables and overrides beat StyleX and Panda in both passes; Tailwind and vanilla-extract stay faster at roughly 9 ns for class-string application and 15–18 ns for overrides. Dynamic matches the native control at 10 styles; at 100 the control stays around 31 ns.

The optimization folds local static definitions when every reference is a direct no-argument call, shares unchanged override style objects, and reads fixed slots directly in generated dynamic functions. At 100 styles, direct-call JavaScript gzip grows from 1,655 to 2,320 bytes and dynamic from 1,775 to 1,869 bytes; callable stays at 1,376 bytes.

An earlier run ([34467564716](https://github.com/wevm/zyzz/actions/runs/34467564716), commit `f30a69c`) predates that optimization and measured Panda at 474–496 ns, StyleX at 17.5–31.3 ns, Tailwind and vanilla-extract at 9.85–18.9 ns, and Zyzz at 73.4–167 ns across callable and override cases.

## React Renders

`pnpm bench:render` drives Vitest Browser Mode over an isolated iframe holding an esbuild production React bundle. Every framework renders the same 100 or 1,000 cards with 10 or 100 distinct styles through its official compiler adapter. Each pass warms three cycles, then measures twenty fresh-root mounts, retained-DOM updates, and remounts; the second pass reverses framework order. Computed CSS is compared with independent native declarations after each operation.

| Metric          | Boundary                                                                           |
| --------------- | ---------------------------------------------------------------------------------- |
| Commit          | Scheduling through React rendering and DOM commit to a layout-effect checkpoint    |
| Commit + layout | Commit plus a forced geometry read, including pending style and layout work        |
| Frame           | Two animation frames after commit; includes refresh wait, not exact paint CPU time |

These measure warm client operations with styles already loaded, not cold navigation, hydration, GPU presentation, or isolated React CPU time. Render timings are the primary runtime report; performance is advisory until repeated runs establish variance, while missing data and correctness failures fail CI. Callable and override cases compare all six adapters; dynamic slots compare Zyzz and native CSS only. In PR runs the base source is measured with the candidate harness; a base that predates grouped output marks that baseline unavailable.

## Source Pipeline

These lanes measure Zyzz stages in isolation and are not cross-library rankings.

| Benchmark                         | Measures                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/compiler/Source.bench.ts`    | Parsing, binding analysis, literal validation, and CSS emission for 10/100/1,000 definitions            |
| `src/compiler/Transform.bench.ts` | The full transform with module rewriting and both source maps, plus a local-theme group with two scopes |
| `src/compiler/Graph.bench.ts`     | 10/100-style consumers linked from serialized library contracts, including JSON validation and emission |
| `src/runtime/Props.bench.ts`      | The generated callable helper with and without class/style overrides                                    |
| `src/node/Host.bench.ts`          | Cold-process rebuilds, unchanged rebuilds, and watch edits for 100 styles in one module                 |
| Theme compilation                 | In-memory emission for 10/100 named styles with two scopes and color-scheme pairs                       |

Transform timing takes at least 30 samples over one second after 10 warmup iterations; baseline comparisons must use the same settings. Setup records CSS, bundled JavaScript including `zyzz/runtime`, and maps under `bench/results/transform/`; map bytes are reported separately from transfer. Watch samples measure from the source write through notification, recompilation, and artifact publication, with a five-second deadline. Contract sidecars are compiler inputs, not client JavaScript, and retain complete token scopes so app extensions can style library components.

Transform also carries property-group workloads at 10 and 100 styles. Each has a browser fixture comparing computed values with native CSS.

| Group             | Filter                           | Output                                      |
| ----------------- | -------------------------------- | ------------------------------------------- |
| Logical boxes     |                                  | `bench/results/transform/logical-*.json`    |
| Flex and overflow |                                  | `bench/results/transform/flex-*.json`       |
| Borders           |                                  | `bench/results/transform/borders-*.json`    |
| Intrinsic sizing  |                                  | `bench/results/transform/sizing-*.json`     |
| Scroll spacing    | `-t 'scroll spacing transform'`  | `bench/results/transform/scrolling-*.json`  |
| Scroll snapping   | `-t 'scroll snap transform'`     | `bench/results/transform/snapping-*.json`   |
| Text flow         | `-t 'text flow transform'`       | `bench/results/transform/text-*.json`       |
| Text decorations  | `-t 'text decoration transform'` | `bench/results/transform/decoration-*.json` |

```sh
pnpm exec vp test bench src/compiler/Transform.bench.ts --run --no-file-parallelism -t 'scroll snap transform' --outputJson bench/results/snapping.json
```

## Variants and Composition

```sh
pnpm exec vp test bench --run src/variants.conditions.bench.ts --no-file-parallelism --outputJson bench/results/conditional-recipes.json
pnpm exec vp test bench src/variants.payloads.bench.ts --run --outputJson bench/results/payload-recipes.json
pnpm exec vp test bench src/cx.runtime.bench.ts --run --outputJson bench/results/runtime-composition.json
pnpm exec vp test bench src/cx.bench.ts src/cx.bindings.bench.ts --run --no-file-parallelism --outputJson bench/results/composition-timings.json
```

- **Conditional recipes** compile static and three-condition recipes through the real compiler and measure default and conditional selection separately.
- **Payloads** bind values to fixed slots; changing values adds no stylesheet rules.
- **Composition** uses the same small, repeated, mostly unique, and component projects as the browser checks, across React and HTML output and direct and immutable bound applications. [Matched review measurements](Composition-review.md) record all 32 lanes with complete artifact accounting.
- **Packed variants** (`src/variants.packed.bench.ts`) measure compiler consumption of versioned contracts at 10/100 applications. The `variants` runtime and render lanes compare native CSS, Panda, StyleX, and Zyzz; [packed and web measurements](Web-variants.md) record delivery, application timings, and the render verification boundary.

Delivery reports separate CSS, JavaScript, serialized attributes, class strings, and server-rendered markup. Client transfer sums CSS and JavaScript; hydrated transfer adds markup. Attribute, class, and helper-only diagnostics are never added to transfer totals.

## Native Variants

The colocated `src/react-native/Variants.bench.ts` measures 9 and 256 selections across two themes and both schemes, plus rejection at 512 selections. [Matched measurements](Native-variants.md) record timing, variance, output size, and the review-fix delta.

## Type Instantiations

Colocated `src/**/*.bench-d.ts` fixtures measure instantiations contributed by public authoring, compiler, runtime, host, and Vite calls. Each fixture declares public values from type-only entrypoint imports, warms shared contracts in an exported `baseline` function, and snapshots each body inline. Attest type-checks the baseline once, then each body appended, and reports the difference. Bodies never execute.

The native fixture warms both `Style.define` and `StyleSheet.compile`, since its structured workflow calls both. These results exclude initial contract instantiation.

With TypeScript 5.9.3, the target-branch validator's cold structured case measured approximately 3.55 million instantiations, versus roughly 20,000 after authoring warmup.

Published declaration domains and per-style component inference increase the warmed structured case from 13,482 to 19,936 instantiations. The increased cold and warmed costs remain optimization targets; warmed results do not establish a startup improvement.

`pnpm bench:types` fails when a body exceeds its baseline by more than 20%. Counts are deterministic for one compiler release, so baselines belong to the pinned version. The Verify workflow checks types on TypeScript 6.0 and 7.0 and runs instantiation benches on 6.0. The native 7.x package ships no compiler API, so its lane installs it under an alias and runs only its `tsc` binary with whole-program diagnostics.

## Next.js and Output Modes

`pnpm bench:check` runs Next.js correctness in atomic and grouped modes. The native-CSS delivery comparison runs only for grouped output and records `next-webpack-grouped.json` and `next-turbopack-grouped.json`. Build timing samples are informational; correctness and transfer thresholds are unchanged.

## Prior Art

The corpus adapts ideas from these suites without copying implementation code:

- [StyleX](https://github.com/facebook/stylex/tree/main/packages/benchmarks): separate transforms, themes, and emitted sizes.
- [TypeStyles' vanilla-extract app](https://github.com/type-styles/typestyles/blob/main/docs/content/docs/benchmarks.md): the buttons, rows, grids, text, inputs, and cards component mix.
- [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4): separate cold, new-CSS, and no-new-CSS build paths.
- [Emotion](https://github.com/emotion-js/emotion/tree/main/scripts/benchmarks), [styled-components](https://github.com/styled-components/styled-components/tree/main/packages/benchmarks), [Stitches](https://stitches.dev/docs/benchmarks), and [Tamagui](https://tamagui.dev/docs/intro/benchmarks): deep and wide mounting, prop updates, and dynamic cardinality.
- [css-in-js-bench](https://github.com/jantimon/css-in-js-bench): shared inputs, production payloads, and independent browser parity checks.

Tamagui is excluded from the PR matrix because its extraction cost dominates CI time. Short CI samples are regression signals, not speed rankings; run longer quiet-machine measurements before making latency claims.
