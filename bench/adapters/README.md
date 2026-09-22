# Application workload

Run `pnpm build && node bench/adapters/Run.ts`. Results are written to ignored `bench/results/adapters.json` and `adapters.md`.

The default corpus contains 96 components with a four-way dependency tree, shared configuration and tokens, global CSS, and three style definitions per component including variants. This is a generated application workload inspired by Tempo's dependency structure, not a reproduction of Tempo's entire application.

`ADAPTER_COMPONENTS` controls size, `ADAPTER_SAMPLES` controls fresh-process repetitions, and `ADAPTER_LANES` selects comma-separated integrations. Each sample uses a new source/output directory. Runs are sequential. OS filesystem caches are not cleared. Raw samples include revision, Node version, CPU, architecture, memory, and component count.

The API lane measures an in-memory graph including import-map preparation. Host and portable bundler lanes retain their public compiler instances for rebuilds. CLI and Vite production builds create a new build each time. Their `unchanged` timings are repeat builds, not incremental HMR. Cold timing includes host setup and compilation, but excludes importing benchmark dependencies and writing the fixture.

Browser lanes measure server startup through rendered computed styles, then atomic file edits through computed styles. A document sentinel and an edited input must survive both updates. Chromium startup and fixture generation are excluded. Browser timings and build timings are separate measurements.

Every build checks token/style changes and removal of deleted CSS. Browser runs check actual rendered values and fail on runtime errors or reloads. There are no absolute timing gates until repeated CI data establishes variance. Baseline and candidate use the same fixture on the same runner; results from different machines are not directly comparable.

The Benchmarks workflow runs each lane in its own job. Pull requests compare base and candidate with the candidate fixture. A failed baseline is reported as unavailable, and candidate correctness still runs. Nightly runs use 384 components. Reports retain raw samples and show median, minimum, and maximum durations. The packed-library fixture contributes global CSS from a compiled sidecar, which every lane verifies.

Run `node bench/adapters/Compare.ts baseline.json candidate.json` to summarize matched reports. Browser cold timing ends at verified computed styles. Network settling happens afterward, before editing. Standalone bundler lanes measure rebuild completion and CSS publication, not browser delivery. Browser delivery is currently covered by Vite and Next.js with both Turbopack and Webpack.

Build reports include final emitted CSS and JavaScript sizes separately as raw, gzip, and Brotli bytes. Source maps are excluded. These are artifact sizes, not a claim about combined network transfer. Worker RSS is sampled at completion, excludes child processes, and is not peak application memory.
