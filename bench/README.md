# Compilation Benchmarks

Definitions live in `bench/Compilation.bench.ts` beside the compiler adapters. Run `pnpm exec vp test bench --run --outputJson bench/results/timings.json`. Reports are ignored by Git.

The separate Benchmarks workflow runs the same command and uploads results, commit, lockfile hash, runtime versions, and host details as a 30-day artifact. It does not compare results from different runners.

For a comparison, measure baseline and candidate sequentially on the same idle machine with the same fixture corpus. Save the baseline outside the checkout, then append `--compare <baseline.json>` when running the candidate. Record variance and measurement limitations with any reported delta.

## Compilation and Bundle Size

`bench/Compilation.bench.ts` compiles the same eight literal declarations for three components, 1,000 repeated components, and 1,000 components with unique padding. No reset, preset theme, responsive rules, or unused components are included. All components are retained in the browser bundle.

The adapters use [StyleX's Babel plugin and rule processor](https://stylexjs.com/docs/api/configuration/babel-plugin/), Tailwind's exported `compile(...).build(candidates)`, and [vanilla-extract's official esbuild plugin](https://vanilla-extract.style/documentation/integrations/esbuild/). Tailwind uses arbitrary-property utilities to preserve the exact literal input.

Each timing includes a fresh compiler build and a minified browser bundle. Modules, filesystem caches, and the esbuild process are warm. Fixture preparation, browser checks, compression, and report writes are outside timing. Tailwind content scanning is excluded; StyleX includes Babel parsing, and vanilla-extract includes source loading and evaluation.

All CSS uses the same esbuild minifier with legal comments and source maps excluded. JSON reports under `bench/results/{small,repeated,unique}/` contain raw, gzip, and Brotli byte sizes for emitted CSS and client JavaScript, including required runtime helpers. Totals sum separately compressed delivery assets; class strings already in JavaScript are not counted again.

The workflow uploads generated CSS, JavaScript, timing reports, size reports, and host metadata. Its summary and updating PR comment group compiler timings and sizes by workload, with variance and additional size metrics in expandable details. Fork PRs retain summaries and artifacts without requiring write access. `bench/Compilation.test.ts` checks equivalent computed declarations in real Chromium for repeated and unique inputs. Install the browser with `pnpm exec playwright install --only-shell chromium` before running tests locally.

Zyzz currently validates definitions but does not emit CSS. Its compilation time and CSS size are explicitly unavailable, never reported as zero. PR 1.2 must add its real compiler to this corpus before drawing comparisons with Zyzz. These fixtures do not establish whole-application or cross-library performance claims.
