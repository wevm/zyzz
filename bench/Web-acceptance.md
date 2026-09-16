# Web acceptance measurements

Diagnostic run on September 16, 2026, using source revision `067ec1648431aa391cacb91d0d3a7c1239a8aa3a`. Only test fixtures and documentation differed locally. The compiler, watcher, and render suites ran sequentially on one macOS workstation. These observations do not establish a main-to-branch regression result or a repeatable performance ranking.

## Compilation and delivery

The repeated and unique workloads each contain 1,000 styles. Means are milliseconds with Tinybench relative margins of error. Delivery totals sum separately compressed CSS and required JavaScript; they exclude application markup and are not package download sizes.

| Library         | Repeated ms    | Repeated gzip B | Unique ms      | Unique gzip B |
| --------------- | -------------- | --------------- | -------------- | ------------- |
| panda           | 83.535 ±7.72%  | 6883            | 121.925 ±7.33% | 14555         |
| stylex          | 98.726 ±19.72% | 844             | 99.176 ±20.43% | 14067         |
| tailwind        | 2.780 ±4.47%   | 1271            | 6.170 ±23.71%  | 8524          |
| vanilla-extract | 24.717 ±1.02%  | 4541            | 22.739 ±2.96%  | 8086          |
| zyzz            | 1.472 ±0.70%   | 458             | 5.063 ±0.62%   | 6597          |

Zyzz uses grouped independent output for these comparisons. All eight corpus workloads ran with the existing adapters and thresholds. Different adapter compilation boundaries remain documented in the [benchmark guide](README.md). Large margins of error, especially StyleX and unique Tailwind timing, limit comparisons.

| Zyzz workload | CSS raw/gzip/Brotli B | JavaScript raw/gzip/Brotli B |
| ------------- | --------------------- | ---------------------------- |
| repeated      | 109/109/62            | 6486/349/297                 |
| unique        | 19949/4239/1871       | 11451/2358/1256              |

## Conditions and file watching

| Operation                           | Mean ms | Margin  | Samples |
| ----------------------------------- | ------- | ------- | ------- |
| Conditional repeated (1,000 styles) | 156.834 | ±1.46%  | 10      |
| Conditional unique (1,000 styles)   | 178.662 | ±2.76%  | 10      |
| cold process rebuild (100 styles)   | 119.944 | ±6.83%  | 3       |
| unchanged rebuild (100 styles)      | 1.038   | ±2.61%  | 97      |
| watch edit (100 styles)             | 52.382  | ±11.30% | 3       |

Conditional compilation includes source parsing, nested hover/media rules, extraction, and rewriting. File-host timing includes real process startup or watcher completion. Three cold/watch samples are diagnostic only. Broader dependency-change and workload sweeps remain open.

## Production React rendering

All 72 groups completed: 100 and 1,000 components, callable styles, overrides, dynamic bindings, and variants. Each group uses three warmup cycles and 20 measured cycles; library order reverses on the second pass. The table shows median commit-plus-forced-layout milliseconds across both passes for Zyzz.

| Components | Workload  | Mount ms | Update ms | Remount ms |
| ---------- | --------- | -------- | --------- | ---------- |
| 100        | callable  | 0.700    | 0.800     | 0.700      |
| 100        | overrides | 0.800    | 1.250     | 0.700      |
| 100        | dynamic   | 1.000    | 0.900     | 0.800      |
| 100        | variants  | 1.000    | 1.000     | 0.900      |
| 1000       | callable  | 5.600    | 5.000     | 5.800      |
| 1000       | overrides | 5.900    | 6.500     | 6.300      |
| 1000       | dynamic   | 7.200    | 7.650     | 7.400      |
| 1000       | variants  | 7.600    | 8.200     | 8.000      |

Measured losses remain: for 1,000-component variant updates, Zyzz recorded 8.200 ms versus StyleX at 7.600 ms and the baseline at 6.700 ms. Dynamic updates recorded 7.650 ms versus the baseline at 7.100 ms. These observations need repetition before a performance conclusion.

Baseline, Panda CSS, StyleX, Tailwind, and vanilla-extract lanes remain in the existing supported workload matrix. The raw report retains frame timings, both passes, and every library; these medians do not imply a ranking or include compilation/loading.

## Reproduction and artifacts

Environment: Apple M4 Max, macOS arm64, Node 25.9.0, pnpm 11.19.0, Chromium 153.0.8010.12. Background workstation activity was not controlled. Repeat runs and matched main/candidate measurements remain required before setting regression thresholds or claiming an advantage.

```sh
pnpm build
pnpm exec vp test bench --run bench/Compilation.bench.ts src/compiler/Transform.conditions.bench.ts src/node/Host.bench.ts src/runtime/Props.bench.ts --no-file-parallelism --outputJson bench/results/web-acceptance-timings.json
pnpm exec vp test run --config bench/Render.config.ts
pnpm exec vp test run --config bench/Check.config.ts bench/Compilation.test.ts bench/Themes.test.ts --no-file-parallelism
```

Generated reports stay under ignored `bench/results/`: `web-acceptance-timings.json`, `render-timings.json`, per-workload delivery JSON/CSS/JavaScript, and per-render size records. The [benchmark guide](README.md) defines adapter boundaries and compression settings.
