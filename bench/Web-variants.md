# Packed Variants and Web Measurements

Measured on 2026-09-13, Linux x64, AMD EPYC 9V74, Node 24.19.0, esbuild 0.28.2. Baseline: main `63994aa14606f50ae3d9244ee8e80777a73338b4`; candidate compiler: `adab39b872e8a49db7461c63f35862181ead4c63`. Web harness: `39d520a4f52f5b1d62e4b3c8db761339bc775edd`. Baseline and candidate ran sequentially on the same host.

## Compiler

Warm in-process compilation, 100ms warmup, 250ms timing window and at least ten samples. Means are milliseconds; uncertainty is relative margin of error. These intervals do not establish a consistent timing change.

| Corpus                                           |  Baseline ms ±% (n) | Candidate ms ±% (n) |
| ------------------------------------------------ | ------------------: | ------------------: |
| cx / static / small (3 styles)                   |  1.459 ±3.83% (172) |  1.529 ±3.97% (164) |
| cx / static / repeated (1000 styles)             | 618.427 ±3.42% (10) | 655.403 ±9.80% (10) |
| cx / static / unique (1000 styles)               | 617.540 ±1.94% (10) | 620.009 ±4.14% (10) |
| cx / static / components (60 styles)             |  14.520 ±4.96% (18) |  15.702 ±6.72% (17) |
| variants / packed composition / 10 applications  |         unsupported |   3.181 ±5.73% (79) |
| variants / packed composition / 100 applications |         unsupported |  19.820 ±8.77% (13) |

Packed compilation is a new operation with no supported baseline. It consumes real extracted publisher contracts at 10/100 application sites. Compilation excludes npm packaging and browser rendering.

## Matched Composition Delivery

Each size cell is raw / gzip / Brotli bytes. All 32 existing lanes retain identical CSS, class references, and markup. Twenty lanes retain identical JavaScript. Twelve HTML lanes add seven raw JavaScript bytes for the versioned cross-runtime symbol; compression changes vary by corpus.

Client transfer sums independently compressed CSS and JavaScript. Hydrated transfer adds independently compressed markup. Class references already appear in JavaScript/markup; helper-only bundles are diagnostic and are not added to either transfer total.

| Lane                                |                    CSS |             Classes |              Markup |                               JS before → after |                           Hydrated before → after | Helper bundle after |
| ----------------------------------- | ---------------------: | ------------------: | ------------------: | ----------------------------------------------: | ------------------------------------------------: | ------------------: |
| small/react/static/direct           |       1356 / 239 / 177 |        95 / 62 / 44 |       153 / 83 / 49 |               885 / 400 / 341 → 885 / 400 / 341 |               2394 / 722 / 567 → 2394 / 722 / 567 |     336 / 247 / 210 |
| small/react/static/bound            |       1357 / 239 / 177 |        96 / 63 / 50 |       154 / 84 / 52 |             2447 / 857 / 754 → 2447 / 857 / 754 |             3958 / 1180 / 983 → 3958 / 1180 / 983 |    1090 / 605 / 525 |
| small/react/conditional/direct      |       1875 / 253 / 189 |        95 / 61 / 43 |       153 / 81 / 51 |             2565 / 862 / 755 → 2565 / 862 / 755 |             4593 / 1196 / 995 → 4593 / 1196 / 995 |    1090 / 605 / 525 |
| small/react/conditional/bound       |       1877 / 261 / 191 |        96 / 63 / 50 |       154 / 84 / 53 |             2728 / 898 / 792 → 2728 / 898 / 792 |           4759 / 1243 / 1036 → 4759 / 1243 / 1036 |    1090 / 605 / 525 |
| small/html/static/direct            |       1356 / 239 / 176 |        95 / 62 / 47 |       153 / 83 / 49 |             1572 / 758 / 660 → 1572 / 758 / 660 |             3081 / 1080 / 885 → 3081 / 1080 / 885 |    1034 / 602 / 516 |
| small/html/static/bound             |       1357 / 239 / 177 |        96 / 63 / 50 |       154 / 84 / 52 |           2901 / 1080 / 960 → 2908 / 1083 / 965 |           4412 / 1403 / 1189 → 4419 / 1406 / 1194 |    1667 / 847 / 746 |
| small/html/conditional/direct       |       1875 / 252 / 187 |        95 / 61 / 43 |       153 / 81 / 51 |           3163 / 1104 / 976 → 3170 / 1108 / 978 |           5191 / 1437 / 1214 → 5198 / 1441 / 1216 |    1667 / 847 / 746 |
| small/html/conditional/bound        |       1877 / 259 / 190 |        96 / 63 / 50 |       154 / 84 / 52 |           3182 / 1122 / 998 → 3189 / 1125 / 999 |           5213 / 1465 / 1240 → 5220 / 1468 / 1241 |    1667 / 847 / 746 |
| repeated/react/static/direct        |   421538 / 8554 / 4976 | 34999 / 3148 / 1667 | 54000 / 3445 / 1760 |   157550 / 16775 / 7209 → 157550 / 16775 / 7209 |   633088 / 28774 / 13945 → 633088 / 28774 / 13945 |     336 / 247 / 210 |
| repeated/react/static/bound         |   421538 / 8598 / 4939 | 34999 / 3154 / 1611 | 54000 / 3412 / 1738 | 450478 / 38175 / 17848 → 450478 / 38175 / 17848 |   926016 / 50185 / 24525 → 926016 / 50185 / 24525 |    1090 / 605 / 525 |
| repeated/react/conditional/direct   |  597538 / 13355 / 6617 | 34999 / 3177 / 1696 | 54000 / 3408 / 1802 | 491180 / 32606 / 17216 → 491180 / 32606 / 17216 | 1142718 / 49369 / 25635 → 1142718 / 49369 / 25635 |    1090 / 605 / 525 |
| repeated/react/conditional/bound    |  597538 / 13299 / 6665 | 34999 / 3163 / 1644 | 54000 / 3358 / 1755 | 549478 / 44811 / 21401 → 549478 / 44811 / 21401 | 1201016 / 61468 / 29821 → 1201016 / 61468 / 29821 |    1090 / 605 / 525 |
| repeated/html/static/direct         |   421538 / 8544 / 4968 | 34999 / 3144 / 1661 | 54000 / 3432 / 1766 |   154249 / 17388 / 7518 → 154249 / 17388 / 7518 |   629787 / 29364 / 14252 → 629787 / 29364 / 14252 |    1034 / 602 / 516 |
| repeated/html/static/bound          |   421538 / 8586 / 4995 | 34999 / 3152 / 1614 | 54000 / 3407 / 1736 | 406746 / 30657 / 14644 → 406753 / 30663 / 14725 |   882284 / 42650 / 21375 → 882291 / 42656 / 21456 |    1667 / 847 / 746 |
| repeated/html/conditional/direct    |  597538 / 13353 / 6460 | 34999 / 3197 / 1695 | 54000 / 3451 / 1801 | 499768 / 32837 / 17293 → 499775 / 32841 / 17287 | 1151306 / 49641 / 25554 → 1151313 / 49645 / 25548 |    1667 / 847 / 746 |
| repeated/html/conditional/bound     |  597538 / 13299 / 6584 | 34999 / 3161 / 1648 | 54000 / 3379 / 1773 | 505746 / 37424 / 18413 → 505753 / 37428 / 18410 | 1157284 / 54102 / 26770 → 1157291 / 54106 / 26767 |    1667 / 847 / 746 |
| unique/react/static/direct          |  423320 / 14570 / 7043 | 34999 / 3133 / 1667 | 54000 / 3422 / 1794 |   157552 / 16673 / 7182 → 157552 / 16673 / 7182 |   634872 / 34665 / 16019 → 634872 / 34665 / 16019 |     336 / 247 / 210 |
| unique/react/static/bound           |  423320 / 14466 / 7680 | 34999 / 3144 / 1638 | 54000 / 3402 / 1736 | 450486 / 37946 / 17721 → 450486 / 37946 / 17721 |   927806 / 55814 / 27137 → 927806 / 55814 / 27137 |    1090 / 605 / 525 |
| unique/react/conditional/direct     | 600210 / 20315 / 10485 | 34999 / 3167 / 1692 | 54000 / 3392 / 1837 | 491186 / 32244 / 16963 → 491186 / 32244 / 16963 | 1145396 / 55951 / 29285 → 1145396 / 55951 / 29285 |    1090 / 605 / 525 |
| unique/react/conditional/bound      | 600210 / 20333 / 10328 | 34999 / 3155 / 1644 | 54000 / 3340 / 1771 | 549486 / 44244 / 21620 → 549486 / 44244 / 21620 | 1203696 / 67917 / 33719 → 1203696 / 67917 / 33719 |    1090 / 605 / 525 |
| unique/html/static/direct           |  423320 / 14519 / 7004 | 34999 / 3132 / 1667 | 54000 / 3420 / 1794 |   154251 / 17236 / 7487 → 154251 / 17236 / 7487 |   631571 / 35175 / 16285 → 631571 / 35175 / 16285 |    1034 / 602 / 516 |
| unique/html/static/bound            |  423320 / 14408 / 7705 | 34999 / 3128 / 1642 | 54000 / 3380 / 1771 | 406752 / 30600 / 14464 → 406759 / 30605 / 14394 |   884072 / 48388 / 23940 → 884079 / 48393 / 23870 |    1667 / 847 / 746 |
| unique/html/conditional/direct      | 600210 / 20293 / 10127 | 34999 / 3198 / 1721 | 54000 / 3437 / 1837 | 499774 / 32468 / 17224 → 499781 / 32471 / 17216 | 1153984 / 56198 / 29188 → 1153991 / 56201 / 29180 |    1667 / 847 / 746 |
| unique/html/conditional/bound       | 600210 / 20305 / 10439 | 34999 / 3157 / 1646 | 54000 / 3370 / 1778 | 505752 / 37027 / 18540 → 505759 / 37031 / 18938 | 1159962 / 60702 / 30757 → 1159969 / 60706 / 31155 |    1667 / 847 / 746 |
| components/react/static/direct      |     26657 / 1092 / 673 |    2039 / 207 / 128 |    3180 / 245 / 141 |           9549 / 1278 / 812 → 9549 / 1278 / 812 |         39386 / 2615 / 1626 → 39386 / 2615 / 1626 |     336 / 247 / 210 |
| components/react/static/bound       |     26657 / 1132 / 691 |    2039 / 233 / 144 |    3180 / 276 / 157 |       27377 / 3155 / 1986 → 27377 / 3155 / 1986 |         57214 / 4563 / 2834 → 57214 / 4563 / 2834 |    1090 / 605 / 525 |
| components/react/conditional/direct |     37857 / 1454 / 897 |    2039 / 231 / 150 |    3180 / 276 / 164 |       29859 / 2936 / 1789 → 29859 / 2936 / 1789 |         70896 / 4666 / 2850 → 70896 / 4666 / 2850 |    1090 / 605 / 525 |
| components/react/conditional/bound  |     37857 / 1464 / 897 |    2039 / 241 / 150 |    3180 / 288 / 163 |       33197 / 3626 / 2249 → 33197 / 3626 / 2249 |         74234 / 5378 / 3309 → 74234 / 5378 / 3309 |    1090 / 605 / 525 |
| components/html/static/direct       |     26657 / 1092 / 674 |    2039 / 207 / 128 |    3180 / 245 / 141 |       10008 / 1691 / 1131 → 10008 / 1691 / 1131 |         39845 / 3028 / 1946 → 39845 / 3028 / 1946 |    1034 / 602 / 516 |
| components/html/static/bound        |     26657 / 1132 / 691 |    2039 / 233 / 143 |    3180 / 276 / 156 |       25445 / 3027 / 1956 → 25452 / 3032 / 1949 |         55282 / 4435 / 2803 → 55289 / 4440 / 2796 |    1667 / 847 / 746 |
| components/html/conditional/direct  |     37857 / 1456 / 900 |    2039 / 231 / 150 |    3180 / 276 / 164 |       30927 / 3206 / 2100 → 30934 / 3210 / 2052 |         71964 / 4938 / 3164 → 71971 / 4942 / 3116 |    1667 / 847 / 746 |
| components/html/conditional/bound   |     37857 / 1464 / 904 |    2039 / 242 / 150 |    3180 / 288 / 164 |       31265 / 3514 / 2254 → 31272 / 3517 / 2235 |         72302 / 5266 / 3322 → 72309 / 5269 / 3303 |    1667 / 847 / 746 |

## Production Browser Application

Chromium 153.0.8010.0, production bundles, 200ms warmup, 100 calibrated batches, forward/reverse library orders. The new variants case selects finite width/opacity and composes a padding override. Dynamic payloads and conditional selections have separate diagnostic lanes below.

Zyzz is faster than Panda and slower than StyleX and native classes in both variant passes. This isolated props-application measurement excludes DOM updates, rendering, layout, and compilation. All pre-existing comparison lanes and their observed losses remain in the complete run below.

### Variant Delivery

| Styles/library |                 CSS |                  JS |          Attributes |            Classes |              Markup |                Client |              Hydrated |    Helper bundle |
| -------------- | ------------------: | ------------------: | ------------------: | -----------------: | ------------------: | --------------------: | --------------------: | ---------------: |
| 10/baseline    |    1225 / 290 / 207 |     772 / 449 / 392 |     775 / 143 / 101 |      304 / 95 / 69 |    1005 / 165 / 121 |      1997 / 739 / 599 |      3002 / 904 / 720 |                — |
| 10/panda       |    1762 / 648 / 551 | 18628 / 6518 / 5788 |    1605 / 277 / 209 |   1134 / 227 / 172 |    1835 / 294 / 223 |   20390 / 7166 / 6339 |   22225 / 7460 / 6562 |                — |
| 10/stylex      |    1443 / 495 / 396 |  3982 / 1598 / 1454 |    1428 / 343 / 280 |    957 / 284 / 234 |    1658 / 363 / 297 |    5425 / 2093 / 1850 |    7083 / 2456 / 2147 |                — |
| 10/zyzz        |    8589 / 780 / 547 |  7772 / 1656 / 1414 |    1190 / 189 / 130 |     374 / 107 / 81 |    1420 / 211 / 142 |   16361 / 2436 / 1961 |   17781 / 2647 / 2103 | 1693 / 856 / 756 |
| 100/baseline   |  11553 / 1260 / 863 |    1582 / 647 / 489 |    7840 / 382 / 244 |   3139 / 307 / 184 |   10140 / 416 / 258 |   13135 / 1907 / 1352 |   23275 / 2323 / 1610 |                — |
| 100/panda      |  7252 / 1822 / 1165 | 45628 / 7604 / 6315 |  16140 / 1030 / 822 |  11439 / 953 / 739 |  18440 / 1053 / 845 |   52880 / 9426 / 7480 |  71320 / 10479 / 8325 |                — |
| 100/stylex     |  8201 / 2191 / 1771 | 18953 / 3480 / 2701 | 14329 / 1625 / 1236 | 9628 / 1526 / 1157 | 16629 / 1651 / 1268 |   27154 / 5671 / 4472 |   43783 / 7322 / 5740 |                — |
| 100/zyzz       | 86821 / 6170 / 3440 | 58309 / 4645 / 2733 |   12000 / 509 / 312 |   3849 / 372 / 234 |   14300 / 533 / 344 | 145130 / 10815 / 6173 | 159430 / 11348 / 6517 | 1693 / 856 / 756 |

### Selection and Binding Diagnostics

Node in-process measurements use the real extracted/compiled variant definitions and runtime functions; default Vitest warmup and 500ms timing windows. These are not browser or React timings. Means are milliseconds; small values represent sub-microsecond function calls.

| Operation                                              |   Mean ms | Error ±% | Samples |
| ------------------------------------------------------ | --------: | -------: | ------: |
| variants / compile / defaults and compounds            | 0.6861684 |     4.04 |     729 |
| variants / select / defaults                           | 0.0002325 |     1.47 | 2150748 |
| variants / select / changed choices and overrides      | 0.0002195 |     2.39 | 2277759 |
| variants / static / compile                            | 0.7346963 |     5.08 |     681 |
| variants / static / select defaults                    | 0.0002633 |     2.15 | 1898891 |
| variants / static / select overrides                   | 0.0002324 |     1.58 | 2151495 |
| variants / three conditions / compile                  | 2.7995294 |     5.51 |     179 |
| variants / three conditions / select defaults          | 0.0002485 |     0.68 | 2012013 |
| variants / three conditions / select overrides         | 0.0004656 |     2.67 | 1073942 |
| variants / payloads / compile                          | 0.9181227 |     3.54 |     545 |
| variants / payloads / bind default                     | 0.0004055 |     1.70 | 1232971 |
| variants / payloads / bind base and conditional values | 0.0007781 |     2.06 |  642594 |
| variants / payloads / remove payload                   | 0.0002004 |     1.05 | 2494460 |

## React Rendering

The production harness retains native CSS/React, Panda, StyleX, Tailwind, vanilla-extract, and Zyzz where equivalent, adding finite variants for native/Panda/StyleX/Zyzz. It validates 72 groups across 100/1,000 components, two library orders, and 20 samples each for mount/update/remount. Commit, forced layout, and two animation frames remain separate.

The full local run passed in Chromium 153.0.8010.0 using the existing browser binary after the CDN download failed. All 72 groups contain 60 valid samples. React 19.2.4, three warmup cycles and twenty measured cycles per pass; compiler and other tests did not run concurrently.

The complete render results below preserve all libraries, operations, and both passes. Small leads are not significance claims. The [PR #146 benchmark workflow](https://github.com/wevm/zyzz/actions/runs/34768022293) also passed its independent production React render job.

## Reproduction

```sh
pnpm exec vp test bench src/cx.bench.ts src/cx.bindings.bench.ts src/variants.packed.bench.ts --run --no-file-parallelism --testNamePattern "cx / static|variants / packed" --outputJson bench/results/packed-timings.json
BENCH_RUNTIME=1 pnpm exec vp test run --config bench/Check.config.ts bench/Runtime.browser.test.ts --no-file-parallelism
pnpm exec vp test bench src/variants.bench.ts src/variants.conditions.bench.ts src/variants.payloads.bench.ts --run --no-file-parallelism --outputJson bench/results/variant-micro.json
pnpm bench:render
```

Run the compiler command on main without the new packed benchmark to reproduce the baseline. Preserve complete artifacts under ignored `bench/results/`; no timing or size thresholds changed.

## Complete Browser Run

## Runtime Framework Comparisons

Summaries rank the average of the two pass means, including the native control; ratios compare the runner-up. Observed leads are not significance claims.

Chromium production props application only; no compilation, DOM or React rendering in timings. Both passes execute inside Chromium on this runner with reversed framework order. Cached props are distinct from surviving calls.

🟢 Zyzz faster beyond reported uncertainty in both passes · 🔴 competitor faster in both passes · 🟡 inconclusive or overlapping uncertainty. Plain class/style is an informational control. No claim of a universal speed advantage follows from a tie.

<details>
<summary>10 Styles — cached: 🟡 Tie: StyleX, Tailwind, Zyzz — 3.7 ns</summary>

| Framework         | Pass 1 (ns ±%) | Pass 2 (ns ±%) |   Samples | CSS gzip | JS gzip | Total gzip |
| ----------------- | -------------: | -------------: | --------: | -------: | ------: | ---------: |
| Plain class/style |      3.7 ±1.2% |      3.9 ±1.5% | 100 / 100 |    237 B |   369 B |      606 B |
| Panda CSS         |      3.9 ±1.9% |      3.6 ±0.4% | 100 / 100 |    605 B |  5833 B |     6438 B |
| StyleX            |      3.7 ±1.1% |      3.7 ±0.9% | 100 / 100 |    432 B |   569 B |     1001 B |
| Tailwind          |      3.7 ±1.7% |      3.6 ±0.7% | 100 / 100 |    386 B |   713 B |     1099 B |
| vanilla-extract   |      4.0 ±3.1% |      3.9 ±2.4% | 100 / 100 |    242 B |   540 B |      782 B |
| 🟡 Zyzz           |      3.7 ±1.0% |      3.8 ±1.3% | 100 / 100 |    275 B |   417 B |      692 B |

</details>

<details>
<summary>10 Styles — direct: 🔴 vanilla-extract — 10.5 ns · 1.09× as fast as Tailwind</summary>

| Framework         | Pass 1 (ns ±%) | Pass 2 (ns ±%) |   Samples | CSS gzip | JS gzip | Total gzip |
| ----------------- | -------------: | -------------: | --------: | -------: | ------: | ---------: |
| Plain class/style |   11.7 ±147.3% |     14.4 ±3.6% | 100 / 100 |    237 B |   394 B |      631 B |
| Panda CSS         |    388.7 ±7.3% |    404.4 ±1.8% | 100 / 100 |    605 B |  5863 B |     6468 B |
| StyleX            |    19.7 ±33.6% |     15.1 ±6.1% | 100 / 100 |    432 B |   593 B |     1025 B |
| Tailwind          |      8.1 ±8.5% |     14.6 ±6.7% | 100 / 100 |    386 B |   739 B |     1125 B |
| vanilla-extract   |     9.8 ±59.8% |     11.2 ±6.4% | 100 / 100 |    242 B |   563 B |      805 B |
| 🟡 Zyzz           |     15.6 ±6.3% |    15.6 ±67.6% | 100 / 100 |    275 B |   681 B |      956 B |

</details>

<details>
<summary>10 Styles — callable: 🔴 Tailwind — 8.1 ns · 1.01× as fast as Plain class/style</summary>

| Framework         | Pass 1 (ns ±%) | Pass 2 (ns ±%) |   Samples | CSS gzip | JS gzip | Total gzip |
| ----------------- | -------------: | -------------: | --------: | -------: | ------: | ---------: |
| Plain class/style |     8.5 ±29.5% |      7.8 ±2.8% | 100 / 100 |    237 B |   367 B |      604 B |
| Panda CSS         |    390.6 ±7.2% |    390.6 ±7.2% | 100 / 100 |    605 B |  5838 B |     6443 B |
| StyleX            |     20.1 ±2.1% |     17.0 ±5.1% | 100 / 100 |    432 B |   574 B |     1006 B |
| Tailwind          |     8.1 ±29.7% |      8.2 ±1.1% | 100 / 100 |    386 B |   712 B |     1098 B |
| vanilla-extract   |     9.3 ±43.8% |      8.3 ±8.7% | 100 / 100 |    242 B |   538 B |      780 B |
| 🟡 Zyzz           |    12.0 ±17.7% |      9.1 ±0.9% | 100 / 100 |    275 B |   590 B |      865 B |

</details>

<details>
<summary>10 Styles — overrides: 🔴 Tailwind — 13.5 ns · 1.07× as fast as Plain class/style</summary>

| Framework         | Pass 1 (ns ±%) | Pass 2 (ns ±%) |   Samples | CSS gzip | JS gzip | Total gzip |
| ----------------- | -------------: | -------------: | --------: | -------: | ------: | ---------: |
| Plain class/style |     14.2 ±5.1% |    14.6 ±10.8% | 100 / 100 |    237 B |   389 B |      626 B |
| Panda CSS         |    396.5 ±6.6% |    382.8 ±7.2% | 100 / 100 |    605 B |  5864 B |     6469 B |
| StyleX            |     26.2 ±6.9% |    22.9 ±14.6% | 100 / 100 |    432 B |   606 B |     1038 B |
| Tailwind          |     13.9 ±6.6% |     13.2 ±1.6% | 100 / 100 |    386 B |   737 B |     1123 B |
| vanilla-extract   |    15.9 ±10.3% |     14.1 ±1.1% | 100 / 100 |    242 B |   561 B |      803 B |
| 🟡 Zyzz           |    18.6 ±25.5% |     16.9 ±0.8% | 100 / 100 |    275 B |   590 B |      865 B |

</details>

<details>
<summary>10 Styles — dynamic: 🔴 Plain class/style — 28.2 ns · 1.80× as fast as Zyzz</summary>

| Framework         | Pass 1 (ns ±%) | Pass 2 (ns ±%) |   Samples | CSS gzip | JS gzip | Total gzip |
| ----------------- | -------------: | -------------: | --------: | -------: | ------: | ---------: |
| Plain class/style |    27.8 ±11.9% |    28.6 ±12.3% | 100 / 100 |    270 B |   416 B |      686 B |
| Zyzz              |     50.5 ±6.3% |     50.8 ±8.5% | 100 / 100 |    390 B |   645 B |     1035 B |

</details>

<details>
<summary>10 Styles — variants: 🔴 Plain class/style — 36.1 ns · 6.47× as fast as StyleX</summary>

| Framework         | Pass 1 (ns ±%) | Pass 2 (ns ±%) |   Samples | CSS gzip | JS gzip | Total gzip |
| ----------------- | -------------: | -------------: | --------: | -------: | ------: | ---------: |
| Plain class/style |     37.0 ±2.6% |    35.2 ±16.2% | 100 / 100 |    290 B |   449 B |      739 B |
| Panda CSS         |   1875.0 ±4.4% |   1910.2 ±6.1% | 100 / 100 |    648 B |  6518 B |     7166 B |
| 🔴 StyleX         |   236.3 ±10.9% |    230.7 ±2.0% | 100 / 100 |    495 B |  1598 B |     2093 B |
| 🔴 Zyzz           |    675.8 ±9.2% |    628.9 ±8.0% | 100 / 100 |    780 B |  1656 B |     2436 B |

</details>

<details>
<summary>100 Styles — cached: 🔴 StyleX — 3.6 ns · 1.03× as fast as Plain class/style</summary>

| Framework         | Pass 1 (ns ±%) | Pass 2 (ns ±%) |   Samples | CSS gzip | JS gzip | Total gzip |
| ----------------- | -------------: | -------------: | --------: | -------: | ------: | ---------: |
| Plain class/style |      3.7 ±2.8% |      3.7 ±2.4% | 100 / 100 |   1191 B |   590 B |     1781 B |
| Panda CSS         |      3.8 ±1.7% |      3.7 ±1.7% | 100 / 100 |   1769 B |  6831 B |     8600 B |
| StyleX            |      3.6 ±0.7% |      3.5 ±0.7% | 100 / 100 |   2119 B |  1822 B |     3941 B |
| Tailwind          |      3.6 ±0.8% |      3.9 ±2.8% | 100 / 100 |   1555 B |  1766 B |     3321 B |
| vanilla-extract   |      3.8 ±2.3% |      3.7 ±1.0% | 100 / 100 |   1218 B |  1008 B |     2226 B |
| 🟡 Zyzz           |      3.7 ±2.1% |      3.7 ±1.7% | 100 / 100 |   1268 B |   731 B |     1999 B |

</details>

<details>
<summary>100 Styles — direct: 🔴 StyleX — 19.1 ns · 1.04× as fast as Tailwind</summary>

| Framework         | Pass 1 (ns ±%) | Pass 2 (ns ±%) |   Samples | CSS gzip | JS gzip | Total gzip |
| ----------------- | -------------: | -------------: | --------: | -------: | ------: | ---------: |
| Plain class/style |     19.5 ±4.4% |     20.4 ±4.4% | 100 / 100 |   1191 B |   832 B |     2023 B |
| Panda CSS         |   414.1 ±11.8% |    418.0 ±9.2% | 100 / 100 |   1769 B |  7157 B |     8926 B |
| StyleX            |     19.0 ±4.1% |     19.2 ±4.6% | 100 / 100 |   2119 B |  2078 B |     4197 B |
| Tailwind          |     19.9 ±7.7% |     19.7 ±3.8% | 100 / 100 |   1555 B |  2014 B |     3569 B |
| vanilla-extract   |     20.9 ±8.2% |     18.7 ±4.2% | 100 / 100 |   1218 B |  1223 B |     2441 B |
| 🟡 Zyzz           |     20.8 ±4.1% |    19.5 ±15.4% | 100 / 100 |   1284 B |  2354 B |     3638 B |

</details>

<details>
<summary>100 Styles — callable: 🟢 Zyzz — 9.1 ns · 1.01× as fast as Tailwind</summary>

| Framework         | Pass 1 (ns ±%) | Pass 2 (ns ±%) |   Samples | CSS gzip | JS gzip | Total gzip |
| ----------------- | -------------: | -------------: | --------: | -------: | ------: | ---------: |
| Plain class/style |   11.7 ±113.4% |      8.9 ±9.2% | 100 / 100 |   1191 B |   559 B |     1750 B |
| Panda CSS         |   457.0 ±11.6% |    421.9 ±9.3% | 100 / 100 |   1769 B |  6837 B |     8606 B |
| StyleX            |     23.6 ±3.7% |     23.3 ±4.6% | 100 / 100 |   2119 B |  1835 B |     3954 B |
| Tailwind          |     8.1 ±10.9% |    10.3 ±13.6% | 100 / 100 |   1555 B |  1754 B |     3309 B |
| vanilla-extract   |     8.7 ±11.0% |     13.1 ±5.5% | 100 / 100 |   1218 B |   980 B |     2198 B |
| 🟡 Zyzz           |      9.0 ±1.2% |      9.2 ±7.8% | 100 / 100 |   1286 B |  1386 B |     2672 B |

</details>

<details>
<summary>100 Styles — overrides: 🔴 Tailwind — 13.9 ns · 1.11× as fast as vanilla-extract</summary>

| Framework         | Pass 1 (ns ±%) | Pass 2 (ns ±%) |   Samples | CSS gzip | JS gzip | Total gzip |
| ----------------- | -------------: | -------------: | --------: | -------: | ------: | ---------: |
| Plain class/style |    18.2 ±12.2% |    14.4 ±10.0% | 100 / 100 |   1191 B |   583 B |     1774 B |
| Panda CSS         |    437.5 ±9.8% |   492.2 ±16.1% | 100 / 100 |   1769 B |  6864 B |     8633 B |
| StyleX            |    30.8 ±10.9% |     37.6 ±8.5% | 100 / 100 |   2119 B |  1872 B |     3991 B |
| 🔴 Tailwind       |    13.7 ±12.9% |    14.0 ±10.2% | 100 / 100 |   1555 B |  1782 B |     3337 B |
| vanilla-extract   |    14.8 ±10.0% |     15.9 ±4.0% | 100 / 100 |   1218 B |  1006 B |     2224 B |
| 🔴 Zyzz           |     17.0 ±8.3% |     17.3 ±8.2% | 100 / 100 |   1286 B |  1387 B |     2673 B |

</details>

<details>
<summary>100 Styles — dynamic: 🔴 Plain class/style — 31.5 ns · 7.59× as fast as Zyzz</summary>

| Framework         | Pass 1 (ns ±%) | Pass 2 (ns ±%) |   Samples | CSS gzip | JS gzip | Total gzip |
| ----------------- | -------------: | -------------: | --------: | -------: | ------: | ---------: |
| Plain class/style |    25.4 ±12.4% |    37.6 ±17.9% | 100 / 100 |   1266 B |   615 B |     1881 B |
| Zyzz              |    239.7 ±1.6% |    238.5 ±1.9% | 100 / 100 |   2072 B |  1847 B |     3919 B |

</details>

<details>
<summary>100 Styles — variants: 🔴 Plain class/style — 35.4 ns · 6.36× as fast as StyleX</summary>

| Framework         | Pass 1 (ns ±%) | Pass 2 (ns ±%) |   Samples | CSS gzip | JS gzip | Total gzip |
| ----------------- | -------------: | -------------: | --------: | -------: | ------: | ---------: |
| Plain class/style |    35.6 ±17.6% |    35.2 ±17.6% | 100 / 100 |   1260 B |   647 B |     1907 B |
| Panda CSS         |   1843.8 ±2.8% |   1894.5 ±4.4% | 100 / 100 |   1822 B |  7604 B |     9426 B |
| 🔴 StyleX         |    220.2 ±1.4% |    230.5 ±9.4% | 100 / 100 |   2191 B |  3480 B |     5671 B |
| 🔴 Zyzz           |    890.6 ±8.1% |   718.7 ±13.2% | 100 / 100 |   6170 B |  4645 B |    10815 B |

</details>

## Complete React Render Run

## Production React Render Performance

Summaries show the lowest average of the two pass medians for commit + layout, including the native control. Ratios compare the runner-up; small leads may be noise.

<details>
<summary>100 cards — callable · mount: 🔴 vanilla-extract — 1.75 ms · 1.03× as fast as tailwind · update: 🟡 Tie: stylex, vanilla-extract — 1.95 ms · remount: 🟡 Tie: Plain class/style, tailwind, vanilla-extract — 1.60 ms</summary>

| Cards | Workload | Framework       | Operation | Pass | Commit median ms | Commit + layout median ms | p95 ms | Frame median ms |
| ----: | -------- | --------------- | --------- | ---: | ---------------: | ------------------------: | -----: | --------------: |
|   100 | callable | baseline        | mount     |    1 |             0.70 |                      2.00 |   2.50 |           28.70 |
|   100 | callable | baseline        | update    |    1 |             0.90 |                      2.00 |   2.50 |           29.20 |
|   100 | callable | baseline        | remount   |    1 |             0.50 |                      1.60 |   2.00 |           28.40 |
|   100 | callable | baseline        | mount     |    2 |             0.60 |                      1.80 |   2.20 |           28.90 |
|   100 | callable | baseline        | update    |    2 |             1.00 |                      2.00 |   2.50 |           29.30 |
|   100 | callable | baseline        | remount   |    2 |             0.50 |                      1.60 |   1.90 |           28.40 |
|   100 | callable | panda           | mount     |    1 |             0.70 |                      1.90 |   2.30 |           29.10 |
|   100 | callable | panda           | update    |    1 |             1.10 |                      2.20 |   3.30 |           29.20 |
|   100 | callable | panda           | remount   |    1 |             0.60 |                      1.80 |   2.60 |           27.70 |
|   100 | callable | panda           | mount     |    2 |             0.80 |                      1.90 |   2.30 |           29.10 |
|   100 | callable | panda           | update    |    2 |             1.00 |                      2.00 |   2.90 |           29.30 |
|   100 | callable | panda           | remount   |    2 |             0.50 |                      1.70 |   2.40 |           28.40 |
|   100 | callable | stylex          | mount     |    1 |             0.70 |                      1.90 |   2.80 |           29.10 |
|   100 | callable | stylex          | update    |    1 |             0.90 |                      1.90 |   2.50 |           29.50 |
|   100 | callable | stylex          | remount   |    1 |             0.50 |                      1.70 |   2.10 |           28.60 |
|   100 | callable | stylex          | mount     |    2 |             0.60 |                      1.80 |   2.20 |           29.10 |
|   100 | callable | stylex          | update    |    2 |             0.90 |                      2.00 |   2.30 |           29.40 |
|   100 | callable | stylex          | remount   |    2 |             0.50 |                      1.60 |   1.80 |           28.80 |
|   100 | callable | tailwind        | mount     |    1 |             0.70 |                      1.80 |   2.10 |           28.90 |
|   100 | callable | tailwind        | update    |    1 |             1.00 |                      2.00 |   2.20 |           29.50 |
|   100 | callable | tailwind        | remount   |    1 |             0.50 |                      1.60 |   1.80 |           28.50 |
|   100 | callable | tailwind        | mount     |    2 |             0.70 |                      1.80 |   2.20 |           29.00 |
|   100 | callable | tailwind        | update    |    2 |             1.00 |                      2.00 |   2.30 |           29.40 |
|   100 | callable | tailwind        | remount   |    2 |             0.50 |                      1.60 |   1.70 |           28.40 |
|   100 | callable | vanilla-extract | mount     |    1 |             0.70 |                      1.70 |   2.10 |           29.10 |
|   100 | callable | vanilla-extract | update    |    1 |             1.00 |                      1.90 |   2.20 |           29.30 |
|   100 | callable | vanilla-extract | remount   |    1 |             0.50 |                      1.60 |   1.80 |           28.60 |
|   100 | callable | vanilla-extract | mount     |    2 |             0.70 |                      1.80 |   2.40 |           28.60 |
|   100 | callable | vanilla-extract | update    |    2 |             1.10 |                      2.00 |   2.40 |           29.50 |
|   100 | callable | vanilla-extract | remount   |    2 |             0.50 |                      1.60 |   1.90 |           28.50 |
|   100 | callable | zyzz            | mount     |    1 |             0.80 |                      1.90 |   2.60 |           28.90 |
|   100 | callable | zyzz            | update    |    1 |             1.10 |                      2.10 |   3.10 |           29.20 |
|   100 | callable | zyzz            | remount   |    1 |             0.60 |                      1.70 |   2.60 |           28.30 |
|   100 | callable | zyzz            | mount     |    2 |             0.70 |                      1.80 |   2.00 |           29.10 |
|   100 | callable | zyzz            | update    |    2 |             1.00 |                      2.00 |   2.30 |           29.30 |
|   100 | callable | zyzz            | remount   |    2 |             0.50 |                      1.60 |   2.70 |           28.40 |

</details>

<details>
<summary>100 cards — overrides · mount: 🔴 tailwind — 1.90 ms · 1.03× as fast as vanilla-extract · update: 🟡 Tie: tailwind, Zyzz — 2.35 ms · remount: 🔴 vanilla-extract — 1.65 ms · 1.06× as fast as tailwind</summary>

| Cards | Workload  | Framework       | Operation | Pass | Commit median ms | Commit + layout median ms | p95 ms | Frame median ms |
| ----: | --------- | --------------- | --------- | ---: | ---------------: | ------------------------: | -----: | --------------: |
|   100 | overrides | baseline        | mount     |    1 |             0.90 |                      2.20 |   2.70 |           28.80 |
|   100 | overrides | baseline        | update    |    1 |             1.10 |                      2.40 |   2.80 |           29.00 |
|   100 | overrides | baseline        | remount   |    1 |             0.60 |                      1.70 |   2.10 |           28.40 |
|   100 | overrides | baseline        | mount     |    2 |             0.90 |                      2.10 |   2.40 |           28.20 |
|   100 | overrides | baseline        | update    |    2 |             1.30 |                      2.50 |   3.70 |           28.80 |
|   100 | overrides | baseline        | remount   |    2 |             0.70 |                      2.00 |   2.70 |           27.70 |
|   100 | overrides | panda           | mount     |    1 |             1.00 |                      2.40 |   2.70 |           28.60 |
|   100 | overrides | panda           | update    |    1 |             1.40 |                      3.00 |   5.00 |           28.80 |
|   100 | overrides | panda           | remount   |    1 |             0.90 |                      2.10 |   2.60 |           27.90 |
|   100 | overrides | panda           | mount     |    2 |             0.90 |                      2.30 |   3.30 |           28.40 |
|   100 | overrides | panda           | update    |    2 |             1.30 |                      2.80 |   3.60 |           28.60 |
|   100 | overrides | panda           | remount   |    2 |             0.70 |                      1.90 |   3.00 |           28.00 |
|   100 | overrides | stylex          | mount     |    1 |             0.90 |                      2.10 |   5.10 |           28.40 |
|   100 | overrides | stylex          | update    |    1 |             1.30 |                      2.70 |   4.80 |           28.90 |
|   100 | overrides | stylex          | remount   |    1 |             0.70 |                      1.90 |   3.80 |           27.90 |
|   100 | overrides | stylex          | mount     |    2 |             0.70 |                      1.90 |   2.80 |           28.80 |
|   100 | overrides | stylex          | update    |    2 |             1.10 |                      2.50 |   3.60 |           29.10 |
|   100 | overrides | stylex          | remount   |    2 |             0.60 |                      1.80 |   2.70 |           28.20 |
|   100 | overrides | tailwind        | mount     |    1 |             0.80 |                      1.90 |   2.60 |           28.70 |
|   100 | overrides | tailwind        | update    |    1 |             1.00 |                      2.30 |   2.60 |           29.30 |
|   100 | overrides | tailwind        | remount   |    1 |             0.60 |                      1.70 |   1.90 |           28.20 |
|   100 | overrides | tailwind        | mount     |    2 |             0.70 |                      1.90 |   2.50 |           28.90 |
|   100 | overrides | tailwind        | update    |    2 |             1.20 |                      2.40 |   2.70 |           28.90 |
|   100 | overrides | tailwind        | remount   |    2 |             0.60 |                      1.80 |   2.10 |           28.20 |
|   100 | overrides | vanilla-extract | mount     |    1 |             0.90 |                      2.00 |   2.50 |           28.90 |
|   100 | overrides | vanilla-extract | update    |    1 |             1.20 |                      2.50 |   2.80 |           29.20 |
|   100 | overrides | vanilla-extract | remount   |    1 |             0.60 |                      1.70 |   2.30 |           28.00 |
|   100 | overrides | vanilla-extract | mount     |    2 |             0.70 |                      1.90 |   2.90 |           28.90 |
|   100 | overrides | vanilla-extract | update    |    2 |             1.00 |                      2.30 |   3.40 |           29.10 |
|   100 | overrides | vanilla-extract | remount   |    2 |             0.60 |                      1.60 |   2.30 |           28.50 |
|   100 | overrides | zyzz            | mount     |    1 |             0.90 |                      2.10 |   2.80 |           28.60 |
|   100 | overrides | zyzz            | update    |    1 |             1.20 |                      2.50 |   3.40 |           29.10 |
|   100 | overrides | zyzz            | remount   |    1 |             0.70 |                      1.90 |   3.30 |           28.20 |
|   100 | overrides | zyzz            | mount     |    2 |             0.80 |                      1.80 |   2.20 |           28.90 |
|   100 | overrides | zyzz            | update    |    2 |             1.00 |                      2.20 |   3.20 |           29.20 |
|   100 | overrides | zyzz            | remount   |    2 |             0.60 |                      1.80 |   2.10 |           28.50 |

</details>

<details>
<summary>100 cards — dynamic · mount: 🔴 Plain class/style — 2.35 ms · 1.11× as fast as Zyzz · update: 🔴 Plain class/style — 2.55 ms · 1.06× as fast as Zyzz · remount: 🔴 Plain class/style — 2.10 ms · 1.07× as fast as Zyzz</summary>

| Cards | Workload | Framework | Operation | Pass | Commit median ms | Commit + layout median ms | p95 ms | Frame median ms |
| ----: | -------- | --------- | --------- | ---: | ---------------: | ------------------------: | -----: | --------------: |
|   100 | dynamic  | baseline  | mount     |    1 |             1.00 |                      2.40 |   2.70 |           28.30 |
|   100 | dynamic  | baseline  | update    |    1 |             1.10 |                      2.60 |   3.10 |           28.50 |
|   100 | dynamic  | baseline  | remount   |    1 |             0.70 |                      2.10 |   2.80 |           28.10 |
|   100 | dynamic  | baseline  | mount     |    2 |             0.90 |                      2.30 |   2.90 |           28.40 |
|   100 | dynamic  | baseline  | update    |    2 |             1.00 |                      2.50 |   3.10 |           28.90 |
|   100 | dynamic  | baseline  | remount   |    2 |             0.70 |                      2.10 |   2.30 |           28.10 |
|   100 | dynamic  | zyzz      | mount     |    1 |             1.00 |                      2.40 |   3.30 |           28.30 |
|   100 | dynamic  | zyzz      | update    |    1 |             1.20 |                      2.60 |   3.80 |           28.90 |
|   100 | dynamic  | zyzz      | remount   |    1 |             0.90 |                      2.20 |   3.70 |           27.90 |
|   100 | dynamic  | zyzz      | mount     |    2 |             1.10 |                      2.80 |   4.50 |           27.70 |
|   100 | dynamic  | zyzz      | update    |    2 |             1.20 |                      2.80 |   4.30 |           28.30 |
|   100 | dynamic  | zyzz      | remount   |    2 |             0.80 |                      2.30 |   3.00 |           28.20 |

</details>

<details>
<summary>100 cards — variants · mount: 🟡 Tie: Plain class/style, stylex — 2.45 ms · update: 🔴 Plain class/style — 2.55 ms · 1.04× as fast as stylex · remount: 🔴 Plain class/style — 2.00 ms · 1.13× as fast as stylex</summary>

| Cards | Workload | Framework | Operation | Pass | Commit median ms | Commit + layout median ms | p95 ms | Frame median ms |
| ----: | -------- | --------- | --------- | ---: | ---------------: | ------------------------: | -----: | --------------: |
|   100 | variants | baseline  | mount     |    1 |             1.00 |                      2.40 |   3.30 |           28.40 |
|   100 | variants | baseline  | update    |    1 |             1.10 |                      2.50 |   3.30 |           28.20 |
|   100 | variants | baseline  | remount   |    1 |             0.70 |                      2.00 |   2.40 |           28.30 |
|   100 | variants | baseline  | mount     |    2 |             1.00 |                      2.50 |   3.50 |           27.40 |
|   100 | variants | baseline  | update    |    2 |             1.00 |                      2.60 |   3.60 |           28.70 |
|   100 | variants | baseline  | remount   |    2 |             0.60 |                      2.00 |   3.20 |           27.80 |
|   100 | variants | panda     | mount     |    1 |             1.10 |                      2.60 |   2.90 |           28.60 |
|   100 | variants | panda     | update    |    1 |             1.20 |                      2.80 |   3.20 |           28.70 |
|   100 | variants | panda     | remount   |    1 |             0.90 |                      2.30 |   2.50 |           28.30 |
|   100 | variants | panda     | mount     |    2 |             1.10 |                      2.60 |   3.40 |           28.30 |
|   100 | variants | panda     | update    |    2 |             1.30 |                      2.90 |   3.40 |           28.80 |
|   100 | variants | panda     | remount   |    2 |             0.90 |                      2.30 |   4.00 |           28.60 |
|   100 | variants | stylex    | mount     |    1 |             0.90 |                      2.40 |   3.60 |           28.20 |
|   100 | variants | stylex    | update    |    1 |             1.00 |                      2.60 |   4.00 |           28.70 |
|   100 | variants | stylex    | remount   |    1 |             0.70 |                      2.20 |   3.20 |           28.10 |
|   100 | variants | stylex    | mount     |    2 |             0.90 |                      2.50 |   2.90 |           27.60 |
|   100 | variants | stylex    | update    |    2 |             1.10 |                      2.70 |   3.40 |           28.40 |
|   100 | variants | stylex    | remount   |    2 |             0.60 |                      2.30 |   2.90 |           27.90 |
|   100 | variants | zyzz      | mount     |    1 |             1.00 |                      2.60 |   3.40 |           27.80 |
|   100 | variants | zyzz      | update    |    1 |             1.20 |                      2.70 |   6.10 |           28.50 |
|   100 | variants | zyzz      | remount   |    1 |             0.80 |                      2.30 |   2.70 |           28.30 |
|   100 | variants | zyzz      | mount     |    2 |             1.10 |                      2.70 |   4.50 |           28.10 |
|   100 | variants | zyzz      | update    |    2 |             1.30 |                      2.90 |   4.80 |           28.60 |
|   100 | variants | zyzz      | remount   |    2 |             0.90 |                      2.60 |   4.50 |           27.70 |

</details>

<details>
<summary>1000 cards — callable · mount: 🟢 Zyzz — 15.45 ms · 1.02× as fast as vanilla-extract · update: 🟢 Zyzz — 15.00 ms · 1.01× as fast as Plain class/style · remount: 🟢 Zyzz — 15.75 ms · 1.04× as fast as Plain class/style</summary>

| Cards | Workload | Framework       | Operation | Pass | Commit median ms | Commit + layout median ms | p95 ms | Frame median ms |
| ----: | -------- | --------------- | --------- | ---: | ---------------: | ------------------------: | -----: | --------------: |
|  1000 | callable | baseline        | mount     |    1 |             2.70 |                     15.80 |  18.00 |           27.00 |
|  1000 | callable | baseline        | update    |    1 |             4.20 |                     14.10 |  18.30 |           21.20 |
|  1000 | callable | baseline        | remount   |    1 |             3.40 |                     15.80 |  20.60 |           31.20 |
|  1000 | callable | baseline        | mount     |    2 |             2.70 |                     15.70 |  20.80 |           27.20 |
|  1000 | callable | baseline        | update    |    2 |             4.80 |                     16.20 |  24.40 |           23.70 |
|  1000 | callable | baseline        | remount   |    2 |             3.90 |                     17.00 |  22.00 |           28.10 |
|  1000 | callable | panda           | mount     |    1 |             3.50 |                     17.00 |  20.60 |           27.20 |
|  1000 | callable | panda           | update    |    1 |             5.50 |                     16.70 |  18.10 |           24.10 |
|  1000 | callable | panda           | remount   |    1 |             4.20 |                     17.30 |  23.40 |           28.80 |
|  1000 | callable | panda           | mount     |    2 |             3.40 |                     17.40 |  22.60 |           28.20 |
|  1000 | callable | panda           | update    |    2 |             5.70 |                     17.00 |  25.70 |           26.40 |
|  1000 | callable | panda           | remount   |    2 |             4.20 |                     18.60 |  27.10 |           32.20 |
|  1000 | callable | stylex          | mount     |    1 |             2.80 |                     16.50 |  22.20 |           27.70 |
|  1000 | callable | stylex          | update    |    1 |             4.90 |                     15.90 |  19.50 |           25.10 |
|  1000 | callable | stylex          | remount   |    1 |             3.60 |                     18.30 |  21.50 |           28.20 |
|  1000 | callable | stylex          | mount     |    2 |             2.60 |                     15.60 |  17.40 |           27.40 |
|  1000 | callable | stylex          | update    |    2 |             4.80 |                     16.50 |  21.80 |           24.10 |
|  1000 | callable | stylex          | remount   |    2 |             3.30 |                     16.90 |  29.20 |           30.30 |
|  1000 | callable | tailwind        | mount     |    1 |             3.00 |                     16.00 |  24.80 |           28.50 |
|  1000 | callable | tailwind        | update    |    1 |             5.00 |                     16.70 |  25.80 |           25.10 |
|  1000 | callable | tailwind        | remount   |    1 |             4.00 |                     17.30 |  25.00 |           29.90 |
|  1000 | callable | tailwind        | mount     |    2 |             2.70 |                     16.10 |  32.80 |           28.70 |
|  1000 | callable | tailwind        | update    |    2 |             4.90 |                     15.30 |  23.30 |           22.50 |
|  1000 | callable | tailwind        | remount   |    2 |             3.60 |                     16.50 |  23.30 |           28.50 |
|  1000 | callable | vanilla-extract | mount     |    1 |             3.30 |                     16.90 |  27.40 |           32.50 |
|  1000 | callable | vanilla-extract | update    |    1 |             5.10 |                     17.30 |  23.80 |           29.40 |
|  1000 | callable | vanilla-extract | remount   |    1 |             3.90 |                     17.80 |  25.30 |           28.20 |
|  1000 | callable | vanilla-extract | mount     |    2 |             2.60 |                     14.50 |  16.50 |           28.10 |
|  1000 | callable | vanilla-extract | update    |    2 |             4.40 |                     14.30 |  17.60 |           21.80 |
|  1000 | callable | vanilla-extract | remount   |    2 |             3.30 |                     15.50 |  20.60 |           27.70 |
|  1000 | callable | zyzz            | mount     |    1 |             2.80 |                     15.50 |  17.90 |           25.90 |
|  1000 | callable | zyzz            | update    |    1 |             4.70 |                     15.20 |  16.60 |           23.00 |
|  1000 | callable | zyzz            | remount   |    1 |             3.60 |                     16.00 |  21.10 |           30.60 |
|  1000 | callable | zyzz            | mount     |    2 |             2.90 |                     15.40 |  18.60 |           27.30 |
|  1000 | callable | zyzz            | update    |    2 |             4.60 |                     14.80 |  16.20 |           22.40 |
|  1000 | callable | zyzz            | remount   |    2 |             3.40 |                     15.50 |  21.70 |           30.20 |

</details>

<details>
<summary>1000 cards — overrides · mount: 🔴 vanilla-extract — 15.70 ms · 1.02× as fast as Plain class/style · update: 🔴 vanilla-extract — 19.55 ms · 1.00× as fast as Zyzz · remount: 🔴 vanilla-extract — 17.05 ms · 1.01× as fast as tailwind</summary>

| Cards | Workload  | Framework       | Operation | Pass | Commit median ms | Commit + layout median ms | p95 ms | Frame median ms |
| ----: | --------- | --------------- | --------- | ---: | ---------------: | ------------------------: | -----: | --------------: |
|  1000 | overrides | baseline        | mount     |    1 |             3.50 |                     15.80 |  19.60 |           27.50 |
|  1000 | overrides | baseline        | update    |    1 |             5.90 |                     20.50 |  24.90 |           28.00 |
|  1000 | overrides | baseline        | remount   |    1 |             4.30 |                     17.40 |  22.20 |           28.30 |
|  1000 | overrides | baseline        | mount     |    2 |             3.80 |                     16.10 |  19.40 |           25.60 |
|  1000 | overrides | baseline        | update    |    2 |             5.70 |                     19.70 |  21.70 |           28.60 |
|  1000 | overrides | baseline        | remount   |    2 |             4.70 |                     17.30 |  22.80 |           30.30 |
|  1000 | overrides | panda           | mount     |    1 |             4.80 |                     18.30 |  28.40 |           30.30 |
|  1000 | overrides | panda           | update    |    1 |             7.50 |                     24.30 |  37.40 |           32.10 |
|  1000 | overrides | panda           | remount   |    1 |             5.20 |                     18.80 |  25.50 |           30.60 |
|  1000 | overrides | panda           | mount     |    2 |             4.20 |                     17.20 |  21.00 |           25.80 |
|  1000 | overrides | panda           | update    |    2 |             7.00 |                     23.20 |  26.70 |           30.90 |
|  1000 | overrides | panda           | remount   |    2 |             5.10 |                     18.10 |  23.80 |           30.40 |
|  1000 | overrides | stylex          | mount     |    1 |             4.00 |                     16.80 |  20.90 |           29.30 |
|  1000 | overrides | stylex          | update    |    1 |             6.20 |                     21.90 |  28.00 |           32.10 |
|  1000 | overrides | stylex          | remount   |    1 |             4.70 |                     18.30 |  24.30 |           30.70 |
|  1000 | overrides | stylex          | mount     |    2 |             5.10 |                     17.60 |  22.40 |           24.80 |
|  1000 | overrides | stylex          | update    |    2 |             7.10 |                     21.40 |  24.40 |           30.00 |
|  1000 | overrides | stylex          | remount   |    2 |             5.10 |                     18.00 |  22.90 |           28.70 |
|  1000 | overrides | tailwind        | mount     |    1 |             3.80 |                     16.80 |  19.90 |           27.60 |
|  1000 | overrides | tailwind        | update    |    1 |             6.50 |                     21.80 |  26.60 |           31.20 |
|  1000 | overrides | tailwind        | remount   |    1 |             4.60 |                     17.50 |  24.60 |           26.80 |
|  1000 | overrides | tailwind        | mount     |    2 |             3.60 |                     15.90 |  20.30 |           26.60 |
|  1000 | overrides | tailwind        | update    |    2 |             5.90 |                     20.00 |  23.90 |           27.50 |
|  1000 | overrides | tailwind        | remount   |    2 |             4.60 |                     16.80 |  23.30 |           28.20 |
|  1000 | overrides | vanilla-extract | mount     |    1 |             3.70 |                     16.10 |  21.00 |           25.70 |
|  1000 | overrides | vanilla-extract | update    |    1 |             5.60 |                     19.40 |  22.60 |           28.10 |
|  1000 | overrides | vanilla-extract | remount   |    1 |             4.50 |                     17.10 |  23.10 |           31.10 |
|  1000 | overrides | vanilla-extract | mount     |    2 |             3.40 |                     15.30 |  18.50 |           27.00 |
|  1000 | overrides | vanilla-extract | update    |    2 |             5.90 |                     19.70 |  24.60 |           27.60 |
|  1000 | overrides | vanilla-extract | remount   |    2 |             4.50 |                     17.00 |  22.00 |           28.50 |
|  1000 | overrides | zyzz            | mount     |    1 |             3.60 |                     16.10 |  19.70 |           26.80 |
|  1000 | overrides | zyzz            | update    |    1 |             5.70 |                     19.40 |  26.60 |           27.10 |
|  1000 | overrides | zyzz            | remount   |    1 |             4.60 |                     17.40 |  21.10 |           29.30 |
|  1000 | overrides | zyzz            | mount     |    2 |             3.80 |                     16.10 |  21.40 |           26.00 |
|  1000 | overrides | zyzz            | update    |    2 |             5.80 |                     19.80 |  25.90 |           28.60 |
|  1000 | overrides | zyzz            | remount   |    2 |             4.90 |                     17.10 |  24.10 |           28.30 |

</details>

<details>
<summary>1000 cards — dynamic · mount: 🟢 Zyzz — 19.15 ms · 1.02× as fast as Plain class/style · update: 🟢 Zyzz — 22.35 ms · 1.04× as fast as Plain class/style · remount: 🟢 Zyzz — 20.30 ms · 1.03× as fast as Plain class/style</summary>

| Cards | Workload | Framework | Operation | Pass | Commit median ms | Commit + layout median ms | p95 ms | Frame median ms |
| ----: | -------- | --------- | --------- | ---: | ---------------: | ------------------------: | -----: | --------------: |
|  1000 | dynamic  | baseline  | mount     |    1 |             4.90 |                     19.50 |  24.60 |           31.70 |
|  1000 | dynamic  | baseline  | update    |    1 |             6.60 |                     23.60 |  30.60 |           35.20 |
|  1000 | dynamic  | baseline  | remount   |    1 |             6.10 |                     22.30 |  33.40 |           34.40 |
|  1000 | dynamic  | baseline  | mount     |    2 |             4.70 |                     19.70 |  24.40 |           33.40 |
|  1000 | dynamic  | baseline  | update    |    2 |             6.00 |                     22.90 |  28.90 |           32.60 |
|  1000 | dynamic  | baseline  | remount   |    2 |             5.30 |                     19.60 |  24.60 |           32.70 |
|  1000 | dynamic  | zyzz      | mount     |    1 |             5.30 |                     19.70 |  38.60 |           33.90 |
|  1000 | dynamic  | zyzz      | update    |    1 |             6.70 |                     23.10 |  27.30 |           33.30 |
|  1000 | dynamic  | zyzz      | remount   |    1 |             6.00 |                     20.50 |  32.50 |           29.40 |
|  1000 | dynamic  | zyzz      | mount     |    2 |             5.10 |                     18.60 |  25.00 |           32.50 |
|  1000 | dynamic  | zyzz      | update    |    2 |             6.30 |                     21.60 |  26.30 |           31.30 |
|  1000 | dynamic  | zyzz      | remount   |    2 |             6.20 |                     20.10 |  25.60 |           30.50 |

</details>

<details>
<summary>1000 cards — variants · mount: 🔴 Plain class/style — 17.75 ms · 1.08× as fast as Zyzz · update: 🔴 Plain class/style — 19.80 ms · 1.09× as fast as Zyzz · remount: 🔴 Plain class/style — 19.00 ms · 1.11× as fast as Zyzz</summary>

| Cards | Workload | Framework | Operation | Pass | Commit median ms | Commit + layout median ms | p95 ms | Frame median ms |
| ----: | -------- | --------- | --------- | ---: | ---------------: | ------------------------: | -----: | --------------: |
|  1000 | variants | baseline  | mount     |    1 |             3.80 |                     17.90 |  27.80 |           32.40 |
|  1000 | variants | baseline  | update    |    1 |             5.10 |                     20.40 |  27.80 |           34.70 |
|  1000 | variants | baseline  | remount   |    1 |             4.70 |                     18.80 |  27.10 |           33.10 |
|  1000 | variants | baseline  | mount     |    2 |             3.90 |                     17.60 |  22.20 |           32.30 |
|  1000 | variants | baseline  | update    |    2 |             4.80 |                     19.20 |  21.20 |           30.50 |
|  1000 | variants | baseline  | remount   |    2 |             5.00 |                     19.20 |  23.50 |           32.70 |
|  1000 | variants | panda     | mount     |    1 |             6.50 |                     21.60 |  27.10 |           35.40 |
|  1000 | variants | panda     | update    |    1 |             8.00 |                     25.00 |  29.60 |           34.70 |
|  1000 | variants | panda     | remount   |    1 |             7.10 |                     22.10 |  29.30 |           32.90 |
|  1000 | variants | panda     | mount     |    2 |             6.30 |                     21.20 |  26.00 |           35.30 |
|  1000 | variants | panda     | update    |    2 |             8.10 |                     25.20 |  30.70 |           39.70 |
|  1000 | variants | panda     | remount   |    2 |             7.50 |                     23.20 |  27.20 |           35.70 |
|  1000 | variants | stylex    | mount     |    1 |             4.60 |                     20.00 |  30.80 |           37.50 |
|  1000 | variants | stylex    | update    |    1 |             5.80 |                     21.80 |  25.80 |           33.60 |
|  1000 | variants | stylex    | remount   |    1 |             5.70 |                     22.40 |  27.90 |           34.20 |
|  1000 | variants | stylex    | mount     |    2 |             4.30 |                     19.20 |  22.10 |           33.00 |
|  1000 | variants | stylex    | update    |    2 |             5.90 |                     21.40 |  27.10 |           31.80 |
|  1000 | variants | stylex    | remount   |    2 |             5.30 |                     20.90 |  28.20 |           35.60 |
|  1000 | variants | zyzz      | mount     |    1 |             5.00 |                     19.20 |  23.20 |           33.10 |
|  1000 | variants | zyzz      | update    |    1 |             6.50 |                     21.40 |  29.30 |           34.20 |
|  1000 | variants | zyzz      | remount   |    1 |             5.80 |                     20.20 |  26.90 |           31.80 |
|  1000 | variants | zyzz      | mount     |    2 |             5.30 |                     19.20 |  24.30 |           34.90 |
|  1000 | variants | zyzz      | update    |    2 |             6.30 |                     21.70 |  25.90 |           32.80 |
|  1000 | variants | zyzz      | remount   |    2 |             6.40 |                     21.80 |  30.40 |           36.70 |

</details>

<details>
<summary>Measurement methodology</summary>

Fresh-root mount, retained-DOM update, and remount after untimed removal. Production React 19.2.4; styles and JavaScript are loaded before timing. Three warmup cycles, twenty measured cycles per pass, reversed framework order on pass two.

Commit includes scheduling, React rendering, and DOM commit through a layout effect. Commit + layout adds a forced geometry read. Frame is a two-animation-frame checkpoint, including refresh wait; it is not paint CPU duration. These are warm-code client operations, not navigation or hydration.

Browser: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.0 Safari/537.36

</details>

Performance comparisons are advisory while repeatability is established. Missing measurements and browser correctness failures fail CI. Dynamic slots compare only Zyzz and native CSS; no dynamic ranking of other frameworks is implied. Function microbenchmarks are separate diagnostics.
