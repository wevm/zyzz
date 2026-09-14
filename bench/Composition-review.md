# Composition Corpus Review Measurements

Candidate: `c2d8df86c640e1e0b33103f38ffb5989f6c96bb4`. Baseline: `5a77528ac748c0522af742d41f56355493dd11f3`. Both use the candidate's identical benchmark harness and source fixtures. Baseline ran first, candidate second, sequentially on the same host. No benchmark thresholds were changed.

The corpus contains 3-style small, 1,000-style repeated, 1,000-style mostly unique, and 60-style component projects from `bench/Corpus.ts`. Every project composes partial shorthand and color overrides with matching media conditions. React/HTML, static/conditional, and direct/bound lanes are retained.

`src/cx.test.ts` verifies every emitted style against native browser controls at 450px and 900px, with conditional overrides disabled and enabled. The measured `apply project` invokes all component applications with conditional overrides enabled and retains the returned array. Compilation, bundling, and module initialization are excluded from that timing.

Runs: 2026-09-13T14:00:34.099Z (baseline metadata) and 2026-09-13T14:06:46.551Z (candidate metadata). Host: AMD EPYC 9V74 80-Core Processor, x64 linux, Node v24.19.0, esbuild 0.28.2, vite-plus 0.2.2 / Vitest 4.1.9. Warmup: 100ms. Measurement: 250ms, with the runner's minimum sample count retained.

These are warm in-process diagnostics on a shared host. Relative margins of error and sample counts accompany all timings. They do not measure cold starts, rendering, layout, hydration, or network latency, and a single run does not establish a performance guarantee.

## Timings

| Lane                                | Compile ms: main → candidate                     | Apply project µs: main → candidate                  |
| ----------------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| static / small (3 styles)           | 1.603 ±5.10% (n=156) → 1.755 ±3.97% (n=143)      | n/a                                                 |
| static / repeated (1000 styles)     | 634.278 ±2.69% (n=10) → 680.341 ±4.26% (n=10)    | n/a                                                 |
| static / unique (1000 styles)       | 706.524 ±5.17% (n=10) → 644.141 ±2.29% (n=10)    | n/a                                                 |
| static / components (60 styles)     | 18.055 ±8.86% (n=14) → 15.683 ±7.56% (n=16)      | n/a                                                 |
| small/react/static/direct           | 1.339 ±4.14% (n=187) → 1.310 ±5.54% (n=193)      | 0.065 ±1.35% (n=3854289) → 0.078 ±2.45% (n=3212530) |
| small/react/static/bound            | 1.366 ±5.58% (n=185) → 1.542 ±4.47% (n=163)      | 2.410 ±4.29% (n=103729) → 2.351 ±2.50% (n=106348)   |
| small/react/conditional/direct      | 1.476 ±5.29% (n=170) → 1.473 ±6.65% (n=172)      | 2.388 ±2.61% (n=104699) → 2.674 ±4.18% (n=93502)    |
| small/react/conditional/bound       | 1.493 ±5.03% (n=168) → 1.601 ±5.78% (n=157)      | 2.212 ±1.65% (n=113008) → 2.508 ±3.02% (n=99684)    |
| small/html/static/direct            | 1.187 ±4.41% (n=211) → 1.271 ±5.22% (n=197)      | 0.088 ±0.97% (n=2832145) → 0.101 ±2.51% (n=2487036) |
| small/html/static/bound             | 1.212 ±6.14% (n=207) → 1.543 ±4.80% (n=163)      | 4.952 ±2.37% (n=50489) → 5.373 ±2.48% (n=46532)     |
| small/html/conditional/direct       | 1.283 ±6.66% (n=195) → 1.762 ±6.56% (n=142)      | 4.940 ±1.70% (n=50609) → 6.987 ±2.41% (n=35780)     |
| small/html/conditional/bound        | 1.638 ±5.36% (n=153) → 1.597 ±7.50% (n=157)      | 5.041 ±1.97% (n=49593) → 5.534 ±2.44% (n=45175)     |
| repeated/react/static/direct        | 667.342 ±1.99% (n=10) → 749.548 ±7.85% (n=10)    | 57.606 ±17.38% (n=4340) → 51.613 ±2.17% (n=4844)    |
| repeated/react/static/bound         | 958.794 ±8.38% (n=10) → 849.906 ±6.52% (n=10)    | 1216.151 ±3.73% (n=206) → 720.722 ±3.78% (n=347)    |
| repeated/react/conditional/direct   | 1078.004 ±6.40% (n=10) → 1087.327 ±8.13% (n=10)  | 805.603 ±4.13% (n=311) → 962.263 ±4.78% (n=260)     |
| repeated/react/conditional/bound    | 1271.426 ±14.24% (n=10) → 1175.751 ±3.17% (n=10) | 787.735 ±3.21% (n=318) → 777.213 ±3.99% (n=322)     |
| repeated/html/static/direct         | 703.926 ±5.13% (n=10) → 725.721 ±3.29% (n=10)    | 55.387 ±1.47% (n=4514) → 51.877 ±2.08% (n=4820)     |
| repeated/html/static/bound          | 621.803 ±4.42% (n=10) → 625.594 ±4.64% (n=10)    | 1679.622 ±3.96% (n=149) → 1641.149 ±2.70% (n=153)   |
| repeated/html/conditional/direct    | 799.302 ±4.14% (n=10) → 776.299 ±4.21% (n=10)    | 1757.585 ±2.43% (n=143) → 1902.063 ±9.61% (n=132)   |
| repeated/html/conditional/bound     | 783.101 ±2.20% (n=10) → 803.495 ±5.47% (n=10)    | 1956.831 ±11.21% (n=128) → 1834.684 ±2.91% (n=137)  |
| unique/react/static/direct          | 680.622 ±2.94% (n=10) → 704.913 ±4.84% (n=10)    | 50.019 ±1.83% (n=4999) → 50.774 ±1.71% (n=4924)     |
| unique/react/static/bound           | 836.290 ±4.02% (n=10) → 875.486 ±4.21% (n=10)    | 707.850 ±3.10% (n=354) → 698.737 ±3.02% (n=360)     |
| unique/react/conditional/direct     | 1121.647 ±6.97% (n=10) → 1021.317 ±2.90% (n=10)  | 875.491 ±5.67% (n=287) → 697.587 ±2.62% (n=359)     |
| unique/react/conditional/bound      | 1192.872 ±8.05% (n=10) → 1096.721 ±3.39% (n=10)  | 966.577 ±4.94% (n=259) → 833.474 ±11.35% (n=300)    |
| unique/html/static/direct           | 694.086 ±3.85% (n=10) → 686.126 ±2.19% (n=10)    | 51.383 ±1.85% (n=4866) → 54.405 ±9.49% (n=4596)     |
| unique/html/static/bound            | 614.058 ±3.16% (n=10) → 692.519 ±6.34% (n=10)    | 1773.149 ±4.52% (n=142) → 1937.903 ±4.94% (n=130)   |
| unique/html/conditional/direct      | 795.161 ±4.26% (n=10) → 807.985 ±5.77% (n=10)    | 2083.956 ±13.81% (n=120) → 1762.104 ±2.87% (n=142)  |
| unique/html/conditional/bound       | 835.214 ±5.43% (n=10) → 838.922 ±5.69% (n=10)    | 1746.665 ±2.62% (n=144) → 1892.429 ±4.29% (n=133)   |
| components/react/static/direct      | 18.761 ±14.13% (n=14) → 16.922 ±11.47% (n=15)    | 0.322 ±2.63% (n=775527) → 0.374 ±3.98% (n=668150)   |
| components/react/static/bound       | 17.219 ±7.45% (n=15) → 14.952 ±6.10% (n=17)      | 40.409 ±3.47% (n=6187) → 41.943 ±5.22% (n=5961)     |
| components/react/conditional/direct | 18.251 ±5.89% (n=14) → 16.996 ±5.78% (n=15)      | 41.159 ±3.51% (n=6074) → 38.052 ±3.07% (n=6570)     |
| components/react/conditional/bound  | 20.037 ±4.94% (n=13) → 17.899 ±5.98% (n=15)      | 50.807 ±3.23% (n=4921) → 65.728 ±12.58% (n=3804)    |
| components/html/static/direct       | 14.935 ±4.28% (n=17) → 13.939 ±4.86% (n=18)      | 0.378 ±3.49% (n=662202) → 0.422 ±11.82% (n=592373)  |
| components/html/static/bound        | 18.021 ±14.09% (n=14) → 16.452 ±5.60% (n=16)     | 104.495 ±3.92% (n=2393) → 108.760 ±2.58% (n=2299)   |
| components/html/conditional/direct  | 18.797 ±19.25% (n=14) → 17.713 ±7.26% (n=15)     | 107.148 ±10.98% (n=2334) → 111.367 ±2.95% (n=2245)  |
| components/html/conditional/bound   | 19.309 ±5.82% (n=13) → 19.965 ±13.58% (n=13)     | 101.811 ±2.77% (n=2456) → 97.772 ±2.54% (n=2557)    |

## Actual combined transfer

Each cell reports raw/gzip/Brotli bytes. Client transfer sums the actual emitted stylesheet and minified client bundle, compressing each asset independently. Hydrated transfer additionally includes the generated fixture element markup. This excludes document boilerplate and HTTP headers. Class strings and helper bytes already present in these artifacts are not added again.

| Lane                                | Client main → candidate                           | Hydrated main → candidate                         |
| ----------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| small/react/static/direct           | 2,241/639/518 → 2,241/639/518                     | 2,394/722/567 → 2,394/722/567                     |
| small/react/static/bound            | 3,804/1,096/931 → 3,804/1,096/931                 | 3,958/1,180/983 → 3,958/1,180/983                 |
| small/react/conditional/direct      | 4,440/1,115/943 → 4,440/1,115/944                 | 4,593/1,196/994 → 4,593/1,196/995                 |
| small/react/conditional/bound       | 4,605/1,159/979 → 4,605/1,159/983                 | 4,759/1,243/1,032 → 4,759/1,243/1,036             |
| small/html/static/direct            | 2,928/997/836 → 2,928/997/836                     | 3,081/1,080/885 → 3,081/1,080/885                 |
| small/html/static/bound             | 4,258/1,319/1,137 → 4,258/1,319/1,137             | 4,412/1,403/1,189 → 4,412/1,403/1,189             |
| small/html/conditional/direct       | 5,038/1,356/1,164 → 5,038/1,356/1,163             | 5,191/1,437/1,215 → 5,191/1,437/1,214             |
| small/html/conditional/bound        | 5,059/1,380/1,184 → 5,059/1,381/1,188             | 5,213/1,464/1,236 → 5,213/1,465/1,240             |
| repeated/react/static/direct        | 579,088/25,329/12,185 → 579,088/25,329/12,185     | 633,088/28,774/13,945 → 633,088/28,774/13,945     |
| repeated/react/static/bound         | 872,016/46,773/22,787 → 872,016/46,773/22,787     | 926,016/50,185/24,525 → 926,016/50,185/24,525     |
| repeated/react/conditional/direct   | 1,088,718/45,957/23,563 → 1,088,718/45,961/23,833 | 1,142,718/49,365/25,365 → 1,142,718/49,369/25,635 |
| repeated/react/conditional/bound    | 1,147,016/58,109/28,025 → 1,147,016/58,110/28,066 | 1,201,016/61,467/29,780 → 1,201,016/61,468/29,821 |
| repeated/html/static/direct         | 575,787/25,932/12,486 → 575,787/25,932/12,486     | 629,787/29,364/14,252 → 629,787/29,364/14,252     |
| repeated/html/static/bound          | 828,284/39,243/19,639 → 828,284/39,243/19,639     | 882,284/42,650/21,375 → 882,284/42,650/21,375     |
| repeated/html/conditional/direct    | 1,097,306/46,186/23,737 → 1,097,306/46,190/23,753 | 1,151,306/49,637/25,538 → 1,151,306/49,641/25,554 |
| repeated/html/conditional/bound     | 1,103,284/50,716/24,988 → 1,103,284/50,723/24,997 | 1,157,284/54,095/26,761 → 1,157,284/54,102/26,770 |
| unique/react/static/direct          | 580,872/31,243/14,225 → 580,872/31,243/14,225     | 634,872/34,665/16,019 → 634,872/34,665/16,019     |
| unique/react/static/bound           | 873,806/52,412/25,401 → 873,806/52,412/25,401     | 927,806/55,814/27,137 → 927,806/55,814/27,137     |
| unique/react/conditional/direct     | 1,091,396/52,565/27,473 → 1,091,396/52,559/27,448 | 1,145,396/55,957/29,310 → 1,145,396/55,951/29,285 |
| unique/react/conditional/bound      | 1,149,696/64,581/32,139 → 1,149,696/64,577/31,948 | 1,203,696/67,921/33,910 → 1,203,696/67,917/33,719 |
| unique/html/static/direct           | 577,571/31,755/14,491 → 577,571/31,755/14,491     | 631,571/35,175/16,285 → 631,571/35,175/16,285     |
| unique/html/static/bound            | 830,072/45,008/22,169 → 830,072/45,008/22,169     | 884,072/48,388/23,940 → 884,072/48,388/23,940     |
| unique/html/conditional/direct      | 1,099,984/52,765/27,220 → 1,099,984/52,761/27,351 | 1,153,984/56,202/29,057 → 1,153,984/56,198/29,188 |
| unique/html/conditional/bound       | 1,105,962/57,337/28,978 → 1,105,962/57,332/28,979 | 1,159,962/60,707/30,756 → 1,159,962/60,702/30,757 |
| components/react/static/direct      | 36,206/2,370/1,485 → 36,206/2,370/1,485           | 39,386/2,615/1,626 → 39,386/2,615/1,626           |
| components/react/static/bound       | 54,034/4,287/2,677 → 54,034/4,287/2,677           | 57,214/4,563/2,834 → 57,214/4,563/2,834           |
| components/react/conditional/direct | 67,716/4,389/2,731 → 67,716/4,390/2,686           | 70,896/4,665/2,895 → 70,896/4,666/2,850           |
| components/react/conditional/bound  | 71,054/5,090/3,160 → 71,054/5,090/3,146           | 74,234/5,378/3,323 → 74,234/5,378/3,309           |
| components/html/static/direct       | 36,665/2,783/1,805 → 36,665/2,783/1,805           | 39,845/3,028/1,946 → 39,845/3,028/1,946           |
| components/html/static/bound        | 52,102/4,159/2,647 → 52,102/4,159/2,647           | 55,282/4,435/2,803 → 55,282/4,435/2,803           |
| components/html/conditional/direct  | 68,784/4,660/2,996 → 68,784/4,662/3,000           | 71,964/4,936/3,160 → 71,964/4,938/3,164           |
| components/html/conditional/bound   | 69,122/4,978/3,177 → 69,122/4,978/3,158           | 72,302/5,266/3,341 → 72,302/5,266/3,322           |

## Candidate artifact accounting

Each cell reports raw/gzip/Brotli bytes. Class references are diagnostic string bytes. Markup is the actual minimal element HTML. Helper artifacts separately bundle the runtime namespaces imported by generated code. Helpers are already included in client JavaScript, so the standalone helper diagnostic is not an additional transfer asset.

| Lane                                | CSS                   | JavaScript            | Class references   | Markup             | Standalone helpers |
| ----------------------------------- | --------------------- | --------------------- | ------------------ | ------------------ | ------------------ |
| small/react/static/direct           | 1,356/239/177         | 885/400/341           | 95/62/44           | 153/83/49          | 336/247/210        |
| small/react/static/bound            | 1,357/239/177         | 2,447/857/754         | 96/63/50           | 154/84/52          | 1,090/605/525      |
| small/react/conditional/direct      | 1,875/253/189         | 2,565/862/755         | 95/61/43           | 153/81/51          | 1,090/605/525      |
| small/react/conditional/bound       | 1,877/261/191         | 2,728/898/792         | 96/63/50           | 154/84/53          | 1,090/605/525      |
| small/html/static/direct            | 1,356/239/176         | 1,572/758/660         | 95/62/47           | 153/83/49          | 1,034/602/516      |
| small/html/static/bound             | 1,357/239/177         | 2,901/1,080/960       | 96/63/50           | 154/84/52          | 1,660/843/743      |
| small/html/conditional/direct       | 1,875/252/187         | 3,163/1,104/976       | 95/61/43           | 153/81/51          | 1,660/843/743      |
| small/html/conditional/bound        | 1,877/259/190         | 3,182/1,122/998       | 96/63/50           | 154/84/52          | 1,660/843/743      |
| repeated/react/static/direct        | 421,538/8,554/4,976   | 157,550/16,775/7,209  | 34,999/3,148/1,667 | 54,000/3,445/1,760 | 336/247/210        |
| repeated/react/static/bound         | 421,538/8,598/4,939   | 450,478/38,175/17,848 | 34,999/3,154/1,611 | 54,000/3,412/1,738 | 1,090/605/525      |
| repeated/react/conditional/direct   | 597,538/13,355/6,617  | 491,180/32,606/17,216 | 34,999/3,177/1,696 | 54,000/3,408/1,802 | 1,090/605/525      |
| repeated/react/conditional/bound    | 597,538/13,299/6,665  | 549,478/44,811/21,401 | 34,999/3,163/1,644 | 54,000/3,358/1,755 | 1,090/605/525      |
| repeated/html/static/direct         | 421,538/8,544/4,968   | 154,249/17,388/7,518  | 34,999/3,144/1,661 | 54,000/3,432/1,766 | 1,034/602/516      |
| repeated/html/static/bound          | 421,538/8,586/4,995   | 406,746/30,657/14,644 | 34,999/3,152/1,614 | 54,000/3,407/1,736 | 1,660/843/743      |
| repeated/html/conditional/direct    | 597,538/13,353/6,460  | 499,768/32,837/17,293 | 34,999/3,197/1,695 | 54,000/3,451/1,801 | 1,660/843/743      |
| repeated/html/conditional/bound     | 597,538/13,299/6,584  | 505,746/37,424/18,413 | 34,999/3,161/1,648 | 54,000/3,379/1,773 | 1,660/843/743      |
| unique/react/static/direct          | 423,320/14,570/7,043  | 157,552/16,673/7,182  | 34,999/3,133/1,667 | 54,000/3,422/1,794 | 336/247/210        |
| unique/react/static/bound           | 423,320/14,466/7,680  | 450,486/37,946/17,721 | 34,999/3,144/1,638 | 54,000/3,402/1,736 | 1,090/605/525      |
| unique/react/conditional/direct     | 600,210/20,315/10,485 | 491,186/32,244/16,963 | 34,999/3,167/1,692 | 54,000/3,392/1,837 | 1,090/605/525      |
| unique/react/conditional/bound      | 600,210/20,333/10,328 | 549,486/44,244/21,620 | 34,999/3,155/1,644 | 54,000/3,340/1,771 | 1,090/605/525      |
| unique/html/static/direct           | 423,320/14,519/7,004  | 154,251/17,236/7,487  | 34,999/3,132/1,667 | 54,000/3,420/1,794 | 1,034/602/516      |
| unique/html/static/bound            | 423,320/14,408/7,705  | 406,752/30,600/14,464 | 34,999/3,128/1,642 | 54,000/3,380/1,771 | 1,660/843/743      |
| unique/html/conditional/direct      | 600,210/20,293/10,127 | 499,774/32,468/17,224 | 34,999/3,198/1,721 | 54,000/3,437/1,837 | 1,660/843/743      |
| unique/html/conditional/bound       | 600,210/20,305/10,439 | 505,752/37,027/18,540 | 34,999/3,157/1,646 | 54,000/3,370/1,778 | 1,660/843/743      |
| components/react/static/direct      | 26,657/1,092/673      | 9,549/1,278/812       | 2,039/207/128      | 3,180/245/141      | 336/247/210        |
| components/react/static/bound       | 26,657/1,132/691      | 27,377/3,155/1,986    | 2,039/233/144      | 3,180/276/157      | 1,090/605/525      |
| components/react/conditional/direct | 37,857/1,454/897      | 29,859/2,936/1,789    | 2,039/231/150      | 3,180/276/164      | 1,090/605/525      |
| components/react/conditional/bound  | 37,857/1,464/897      | 33,197/3,626/2,249    | 2,039/241/150      | 3,180/288/163      | 1,090/605/525      |
| components/html/static/direct       | 26,657/1,092/674      | 10,008/1,691/1,131    | 2,039/207/128      | 3,180/245/141      | 1,034/602/516      |
| components/html/static/bound        | 26,657/1,132/691      | 25,445/3,027/1,956    | 2,039/233/143      | 3,180/276/156      | 1,660/843/743      |
| components/html/conditional/direct  | 37,857/1,456/900      | 30,927/3,206/2,100    | 2,039/231/150      | 3,180/276/164      | 1,660/843/743      |
| components/html/conditional/bound   | 37,857/1,464/904      | 31,265/3,514/2,254    | 2,039/242/150      | 3,180/288/164      | 1,660/843/743      |

## Reproduce

```sh
pnpm exec vp test run src/cx.test.ts --no-file-parallelism
pnpm exec vp test bench src/cx.bench.ts src/cx.bindings.bench.ts --run --no-file-parallelism --outputJson bench/results/composition-timings.json
```

Repeat on the baseline checkout with the candidate fixture and benchmark files copied unchanged. The generated `composition-bindings-metadata.json` records every source SHA-256, artifact measurement, and per-module helper contribution in the actual bundle. The timing JSON preserves variance and sample counts. Both reports remain under ignored `bench/results/`.

## Timing confirmation

The full run reported +27.32% and +37.31% compilation time for the two small HTML lanes below. A second matched run selected those lanes with identical fixture preparation, baseline first and candidate second. All original full-run results above are retained.

| Lane                          | Main compile ms      | Candidate compile ms | Observed delta |
| ----------------------------- | -------------------- | -------------------- | -------------- |
| small/html/static/bound       | 1.427 ±6.37% (n=178) | 1.426 ±6.49% (n=176) | -0.06%         |
| small/html/conditional/direct | 1.290 ±4.42% (n=194) | 1.355 ±5.13% (n=185) | +5.03%         |

Reproduce the confirmation with `--testNamePattern "small/html/(static/bound|conditional/direct)" --outputJson bench/results/composition-confirm.json`. These short compilation cases vary between runs. The confirmation is additional evidence, not a replacement baseline or a changed acceptance threshold.

