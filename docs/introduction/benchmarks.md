# Benchmarks

Benchmarks compare real compiler workflows and equivalent rendered styles. Results depend on workload and measurement boundaries; there is no universal performance ranking.

```sh
pnpm exec vp test bench --run --no-file-parallelism --outputJson bench/results/timings.json
```

- **Compilation:** small, repeated, unique, and mixed literal workloads.
- **Delivery:** raw, gzip, and Brotli CSS plus client JavaScript, including required helpers.
- **Incremental work:** source transforms and host edits have separate measurements.
- **Reproduction:** baseline and candidate run sequentially on the same machine with pinned dependencies.

The benchmark workflow publishes per-run results and metadata. Follow [benchmark methodology](../../bench/README.md) for corpus details, comparison limitations, artifacts, and reproduction. Generated reports remain ignored; this page does not substitute historical numbers for a current run.

> [!NOTE]
> Full application, dynamic variant, SSR, and native rendering workloads require their corresponding implementation stages. Current literal results do not demonstrate those capabilities.
