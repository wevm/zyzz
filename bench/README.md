# Authoring Baseline

Run `pnpm exec vp test bench --run --outputJson bench/results/define.json`. Compare a later run with `pnpm exec vp test bench --run --compare bench/results/define.json`. Run baseline and candidate on the same machine without competing benchmark jobs; do not compare timings from unrelated CI runners.

The [report](results/define.json) records means in milliseconds, sample counts, variance, and relative error. [Metadata](results/define.metadata.json) records the measured commit, source hashes, versions, exposed hardware, fixture sizes, cache state, and runner defaults. Only the report path was normalized; measurements are unchanged.

Inputs reuse the integration component fixture. Timing includes public validation, copying, and freezing. Input construction happens before timing. This is warm in-process authoring work; it is not a cold-build, emission, browser, or native benchmark. Those measurements require later phases.

The saved run measured roughly 6.1 µs for three components, 3.58 ms for 1,000 repeated cards, and 3.38 ms for 1,000 mostly unique cards. Relative error ranges from 1.75% to 8.16%; shared-host scheduling and GC noise are visible. This establishes a baseline, not a performance budget or comparison with other libraries.

No CSS, generated component JavaScript, or rendering artifacts exist at this boundary. Their bundle sizes and performance are unmeasured, not zero. Record those artifacts and raw/gzip/Brotli transfer sizes when emission and source transforms land.
