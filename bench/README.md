# Compilation Benchmarks

Definitions live in `bench/Compilation.bench.ts` beside the compiler adapters, with shared workloads in `bench/Corpus.ts`. Run `pnpm exec vp test bench --run --outputJson bench/results/timings.json`. Reports are ignored by Git.

The separate Benchmarks workflow runs the same command and uploads results, commit, lockfile hash, runtime versions, and host details as a 30-day artifact. It does not compare results from different runners.

For a comparison, measure baseline and candidate sequentially on the same idle machine with the same fixture corpus. Save the baseline outside the checkout, then append `--compare <baseline.json>` when running the candidate. Record variance and measurement limitations with any reported delta.

## Compilation and Bundle Size

`bench/Compilation.bench.ts` compiles the same eight literal declarations for three components, 1,000 repeated components, and 1,000 components with unique padding. No reset, preset theme, responsive rules, or unused components are included. All components are retained in the browser bundle.

The adapters use [StyleX's Babel plugin and rule processor](https://stylexjs.com/docs/api/configuration/babel-plugin/), Tailwind's exported `compile(...).build(candidates)`, and [vanilla-extract's official esbuild plugin](https://vanilla-extract.style/documentation/integrations/esbuild/). Tailwind uses arbitrary-property utilities to preserve the exact literal input.

Each timing includes a compiler build and a minified browser bundle. Modules, filesystem caches, and esbuild are warm for in-process adapters. Tamagui additionally includes a fresh isolated process, as detailed below. Fixture preparation, browser checks, compression, and report writes are outside timing. Tailwind content scanning is excluded; StyleX includes Babel parsing, and vanilla-extract includes source loading and evaluation.

All CSS uses the same esbuild minifier with legal comments and source maps excluded. JSON reports under `bench/results/{small,repeated,unique}/` contain raw, gzip, and Brotli byte sizes for emitted CSS and client JavaScript, including required runtime helpers. Totals sum separately compressed delivery assets; class strings already in JavaScript are not counted again.

The workflow uploads generated CSS, JavaScript, timing reports, size reports, and host metadata. Its summary and updating PR comment group compiler timings and sizes by workload, with variance and additional size metrics in expandable details. Fork PRs retain summaries and artifacts without requiring write access. `bench/Compilation.test.ts` checks equivalent computed declarations in real Chromium for repeated and unique inputs. Install the browser with `pnpm exec playwright install --only-shell chromium` before running tests locally.

Zyzz runs `Css.compile` from `zyzz/web` on prepared `Style.define` data, followed by the same CSS minification and browser bundling. Definition validation is outside timing, like Tailwind candidate preparation. Zyzz has no source extraction yet; StyleX and vanilla-extract include their source pipelines. The compiler factors identical nonconflicting declaration domains and retains ordered rules for conflicts. No source rewriting or general atomic optimizer is enabled. These fixtures do not establish whole-application or cross-library performance claims.

## Size Gate

The real browser integration corpus requires Zyzz's total CSS plus client JavaScript to be smaller than StyleX in raw, gzip, and Brotli bytes for all three workloads. Each asset is compressed independently. Both compilers use the same retained components and minification settings. The gate runs alongside computed-style equivalence and does not alter the StyleX adapter.

Current local total gzip baselines are 468 versus 558 bytes (small), 559 versus 846 bytes (repeated), and 8,106 versus 14,013 bytes (unique), Zyzz versus StyleX. This does not claim every individual asset is smaller: unique raw CSS remains larger. Broader selectors, themes, variants, and application workloads must earn the same budget as they are implemented.

## Expanded Corpus and Prior Art

The corpus adapts benchmark ideas, without copying third-party implementation code:

- [StyleX](https://github.com/facebook/stylex/tree/main/packages/benchmarks) separates basic/complex transforms, themes, and emitted sizes. The literal corpus now exercises partial sharing, palette reuse, independent values, and sparse properties.
- [TypeStyles' vanilla-extract reference app](https://github.com/type-styles/typestyles/blob/main/docs/content/docs/benchmarks.md) motivates the component mix: buttons, rows, grids, text, inputs, and cards. Our 60-style literal fixture is independently authored and intentionally excludes unsupported themes/recipes.
- [Tailwind](https://tailwindcss.com/blog/tailwindcss-v4) motivates separate cold, new-CSS, and no-new-CSS build paths; these await source/watch adapters.
- [Emotion](https://github.com/emotion-js/emotion/tree/main/scripts/benchmarks), [styled-components](https://github.com/styled-components/styled-components/tree/main/packages/benchmarks), [Stitches](https://stitches.dev/docs/benchmarks), and [Tamagui](https://tamagui.dev/docs/intro/benchmarks) motivate deep/wide mounting, prop updates, and dynamic cardinality. These await the corresponding Zyzz component APIs.
- [css-in-js-bench](https://github.com/jantimon/css-in-js-bench) motivates shared inputs, production payloads, SSR/hydration, and independent browser parity checks.

`Corpus.ts` defines eight workloads. The original three remain size-gated against StyleX. Five discovery workloads cover partial sharing, a 16-value palette, independently varying fields, sparse property sets, and mixed component shapes. Values use fixed integer mixing, not random seeds or clocks. Discovery cases publish every result, including losses; they do not silently broaden the existing claim of three gated wins.

Every compiler renders against browser-interpreted literal CSS, rather than another compiler's output. Checks cover the union of authored properties and style count. Declaration counts are measured from each fixture instead of assuming eight per component.

## Additional Compiler Adapters

Panda CSS uses `@pandacss/node` config loading, code generation, source extraction, and CSS emission, followed by the common esbuild browser bundler. The base utility preset is enabled, the design-token preset and preflight are disabled, and required generated helpers and base CSS are retained. Generated `.mjs` modules use normal esbuild resolution.

Tamagui uses `@tamagui/static` on literal `View` JSX, requires every component to flatten, and bundles the emitted JSX with the real production React JSX runtime. Class references come from the resulting React elements; retained helpers and config `getCSS()` output are counted. View defaults are explicitly reset to ordinary div semantics before applying corpus declarations, so native flex defaults cannot distort the comparison. Unitless line-height is authored as a CSS string because native numeric lengths have different semantics.

Tamagui's evaluation hooks run in a bounded child process to isolate them from the benchmark runner. Its timing includes process startup and config evaluation, unlike the warm in-process adapters. Do not interpret these timings as a matched core-emitter speed ranking. Its generated CSS and client artifacts are still measured with the same minifier and compression settings. Generated config caches are ignored.

The PR report groups all six compilers by workload. Short CI samples are regression signals, not precise speed rankings; retain sample counts and error bars and run longer quiet-machine measurements before making latency claims. No other styling libraries are added.
