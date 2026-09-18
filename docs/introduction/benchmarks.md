# Benchmarks

## Snapshot

Recorded **2026-09-08** from [benchmark run 34204628141](https://github.com/wevm/zyzz/actions/runs/34204628141), commit [9f9d42c](https://github.com/wevm/zyzz/commit/9f9d42c384bcd887fff8956e70b078ee75501bc2). These are historical measurements, not live results. The GitHub-hosted workflow used `ubuntu-latest`; its artifact records the environment and dependency lockfile.

### Literal Compilation

Timings include compilation, common CSS minification, and browser JavaScript bundling. Zyzz starts from validated in-memory definitions using independent composition; source parsing and runtime composition are excluded. Other libraries have different source-processing costs.

#### Mean Build Time

Milliseconds; lower is better.

| Workload                            | Panda CSS |  StyleX | Tailwind | vanilla-extract |  Zyzz |
| ----------------------------------- | --------: | ------: | -------: | --------------: | ----: |
| 3 Components                        |    40.991 |   6.205 |    3.646 |          10.183 |  1.18 |
| 1,000 Components — Repeated Styles  |     257.7 | 291.716 |    7.464 |          68.711 | 5.861 |
| 1,000 Components — Unique Padding   |   300.617 | 551.217 |   32.213 |          70.139 | 9.819 |
| 100 Components — Partial Sharing    |     74.03 |  28.327 |    5.924 |          11.959 | 2.148 |
| 100 Components — Reused Palette     |    59.632 |   26.47 |    3.864 |          11.393 | 1.687 |
| 100 Components — Independent Values |   144.626 |  28.183 |    7.253 |          14.414 | 2.908 |
| 100 Components — Sparse Properties  |    46.409 |  21.705 |    4.031 |          12.211 | 2.106 |
| 60 Components — Mixed Shapes        |    39.992 |  20.353 |    3.166 |          10.431 | 1.645 |

Literal timing samples ranged from 3–85 per case, with reported relative margins of error from 5.6–110.8%. Treat timings as a noisy snapshot, not a guaranteed ranking. Compare repeated runs on the same machine before drawing speed conclusions.

#### CSS Size

Gzip bytes; lower is better.

| Workload                            | Panda CSS | StyleX | Tailwind | vanilla-extract | Zyzz |
| ----------------------------------- | --------: | -----: | -------: | --------------: | ---: |
| 3 Components                        |       436 |    181 |      219 |             121 |  111 |
| 1,000 Components — Repeated Styles  |       436 |    181 |      219 |            2094 |  111 |
| 1,000 Components — Unique Padding   |      5287 |   7806 |     5026 |            5640 | 4669 |
| 100 Components — Partial Sharing    |      1769 |   2119 |     1555 |            1218 | 1141 |
| 100 Components — Reused Palette     |       628 |    451 |      410 |             647 |  242 |
| 100 Components — Independent Values |      3545 |   4375 |     3315 |            2281 | 2229 |
| 100 Components — Sparse Properties  |      1216 |   1278 |      984 |             964 |  849 |
| 60 Components — Mixed Shapes        |       626 |    407 |      406 |             449 |  287 |

#### Total Delivery

Gzip bytes for CSS plus required client JavaScript, compressed separately. Class strings already contained in JavaScript are not counted twice.

| Workload                            | Panda CSS | StyleX | Tailwind | vanilla-extract | Zyzz |
| ----------------------------------- | --------: | -----: | -------: | --------------: | ---: |
| 3 Components                        |      5945 |    556 |      623 |             456 |  431 |
| 1,000 Components — Repeated Styles  |      6914 |    844 |     1276 |            4543 |  473 |
| 1,000 Components — Unique Padding   |     14607 |  14010 |     8534 |            8089 | 7275 |
| 100 Components — Partial Sharing    |      8407 |   3891 |     2871 |            1776 | 1703 |
| 100 Components — Reused Palette     |      6427 |   1079 |     1039 |            1205 |  625 |
| 100 Components — Independent Values |     11670 |   7236 |     5936 |            2840 | 2791 |
| 100 Components — Sparse Properties  |      7524 |   2396 |     2051 |            1523 | 1409 |
| 60 Components — Mixed Shapes        |      6357 |    949 |     1017 |             917 |  650 |

### Theme Compilation

Two compatible scopes with light/dark values. All lanes include CSS and component/scope JavaScript delivery. `zyzz` starts from validated references; `zyzz-tokens` additionally validates and resolves shorthand tokens. Neither Zyzz lane includes source parsing.

#### 10 Components

| Library         | Build (ms) | CSS gzip | JS gzip | Total gzip |
| --------------- | ---------: | -------: | ------: | ---------: |
| panda           |     46.943 |      545 |    5564 |       6109 |
| stylex          |      26.93 |      319 |     461 |        780 |
| tailwind        |       3.64 |      298 |     413 |        711 |
| vanilla-extract |      9.617 |      203 |     389 |        592 |
| zyzz            |      1.397 |      256 |     389 |        645 |
| zyzz-tokens     |       1.83 |      256 |     389 |        645 |

#### 100 Components

| Library         | Build (ms) | CSS gzip | JS gzip | Total gzip |
| --------------- | ---------: | -------: | ------: | ---------: |
| panda           |     64.656 |      945 |    5928 |       6873 |
| stylex          |    139.274 |     1064 |    1007 |       2071 |
| tailwind        |      4.564 |      686 |     661 |       1347 |
| vanilla-extract |     15.154 |      640 |     596 |       1236 |
| zyzz            |      3.096 |      615 |     603 |       1218 |
| zyzz-tokens     |      4.086 |      615 |     603 |       1218 |

Theme timings used 3–72 samples per case; reported relative margins of error ranged from 7.14–68.8%.

The 10-component theme case has smaller gzip delivery with vanilla-extract than Zyzz. Keep this result alongside the larger and literal workloads; output size depends on the workload.

## Reproduce

```sh
pnpm exec vp test bench --run --no-file-parallelism --outputJson bench/results/timings.json
```

- **Artifacts:** the run contains raw, gzip, Brotli, timing, and environment reports.
- **Corpus:** eight literal workloads and two theme comparisons are retained above.
- **Processing:** literal CSS targets Chrome 120, Firefox 128, Safari 17; theme CSS targets Chrome 123, Firefox 128, Safari 17.5.
- **Scope:** source extraction, module rewriting, props binding, and host edits have separate measurements in the run report.

See the [methodology at this commit](https://github.com/wevm/zyzz/blob/9f9d42c384bcd887fff8956e70b078ee75501bc2/bench/README.md) for compiler boundaries and sample configuration. Generated reports stay ignored; this curated snapshot is intentionally committed. Update all comparison lanes from one identified run.

> [!NOTE]
> The literal results above do not measure application rendering, dynamic variants, SSR, or native rendering. See the [variant measurements](../../bench/Web-variants.md) for the separate web workloads.
