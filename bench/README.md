# Authoring Benchmarks

Definitions live in `src/Style.bench.ts` beside `Style.ts`. Run `node bench/run.ts`. Reports and host metadata are written to ignored `bench/results/`. Keep benchmark definitions and fixture inputs in Git; generated results belong in CI artifacts. Record useful summaries and measurement limitations in PR descriptions.

The verification workflow uploads a `benchmarks` artifact for each run, including the measured commit and host metadata. It downloads the latest available main-branch artifact as a comparison baseline. Until main has produced an artifact, it records results without a comparison. Artifacts expire after 30 days.

For a local comparison, download a main run's artifact with `gh run download <run-id> --name benchmarks --dir bench/results/main`, then run `node bench/run.ts`. The runner passes the baseline to Vitest's `--compare`. Different CI hosts introduce scheduling and hardware noise; artifact comparisons are informational, not performance gates. Confirm suspected regressions by running both revisions on the same machine.

Inputs reuse integration fixtures: three components with 20 declarations, and 1,000 repeated or mostly unique cards with 13,000 declarations each. Timing includes validation, copying, and freezing; input creation occurs before timing. Runner defaults use 100 ms/five-iteration warmup and at least 500 ms/ten measured iterations. Reports include variance and sample counts; the lockfile pins the runner versions.

This measures warm authoring work. CSS emission, generated component JavaScript, browser rendering, and native measurements begin when those phases exist; their cost is unmeasured, not zero. Record raw/gzip/Brotli sizes when emitted artifacts exist.
