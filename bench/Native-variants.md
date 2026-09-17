# Native variant compilation

`src/react-native/Variants.bench.ts` measures `Variants.compile` with source-extracted recipes, themed tokens, defaults, a compound, and native/iOS overrides. Source extraction, theme creation, and artifact serialization occur outside timing. Every accepted recipe compiles two named themes and both schemes.

## Reproduction

```sh
pnpm exec vp test bench src/react-native/Variants.bench.ts --run --no-file-parallelism --outputJson bench/results/native-variants.json
```

Use `--compare <baseline.json>` for matched runs. The existing Benchmarks workflow discovers this colocated file and uploads timing and size artifacts. Ordinary test discovery excludes benchmarks.

## Measurement

Measured on 2026-09-17 with Apple M4 Max, 36 GiB RAM, macOS, Node 25.9.0, pnpm 11.19.0, Vite Plus 0.2.2, and Vitest 4.1.9. Baseline source was `4fefc429cee464d4efe9fdf0a269098462184451`; the candidate is `57d4bc7`, which adds dense choice validation. Both used the same new benchmark fixture and installed dependencies.

Runs were sequential on the same workstation, without another benchmark process. These are warm in-process compilations, with no persisted compilation cache. Each lane warms for at least 500 ms and 10 iterations, then samples for at least 1,000 ms and 30 iterations. This is local evidence, not hosted CI or device rendering evidence.

The parent PR has no `Variants.compile` implementation, so a parent-to-feature timing ratio is unavailable. The comparison below measures the review fix against the existing PR implementation.

| Run         |   Selections | Mean (ms) | Relative error | Samples |   Delta |
| ----------- | -----------: | --------: | -------------: | ------: | ------: |
| baseline    |            9 |  0.146832 |         ±0.51% |    6811 |     n/a |
| baseline    |          256 |  4.710598 |         ±1.15% |     213 |     n/a |
| baseline    | 512 rejected |  0.004819 |         ±0.29% |  207505 |     n/a |
| baseline-2  |            9 |  0.149413 |         ±0.48% |    6693 |     n/a |
| baseline-2  |          256 |  4.694016 |         ±0.95% |     214 |     n/a |
| baseline-2  | 512 rejected |  0.004897 |         ±0.22% |  204190 |     n/a |
| candidate   |            9 |  0.148889 |         ±0.56% |    6717 |  +1.40% |
| candidate   |          256 |  8.065818 |        ±34.41% |     124 | +71.23% |
| candidate   | 512 rejected |  0.005024 |         ±1.73% |  199039 |  +4.25% |
| candidate-2 |            9 |  0.149344 |         ±0.81% |    6696 |  -0.05% |
| candidate-2 |          256 |  4.884602 |         ±1.18% |     205 |  +4.06% |
| candidate-2 | 512 rejected |  0.004835 |         ±0.29% |  206840 |  -1.28% |
| candidate-3 |            9 |  0.151110 |         ±0.79% |    6618 |  +1.14% |
| candidate-3 |          256 |  5.033378 |         ±3.50% |     199 |  +7.23% |
| candidate-3 | 512 rejected |  0.004950 |         ±0.19% |  202021 |  +1.07% |

Candidate run 1 compares with baseline run 1. Candidate runs 2 and 3 compare with baseline run 2. The first 256-selection candidate measurement has 34.41% relative error and is inconclusive. Repeats measured 4.8846 and 5.0334 ms against 4.6940 ms, increases of 4.06% and 7.23%. No speed improvement is claimed.

The nine-selection lane remains near 0.15 ms. The 512-selection recipe is rejected before native table allocation, around 0.005 ms. The regression suite independently verifies acceptance at 256 and rejection above the limit.

## Output size

Baseline and candidate produce identical sizes and entry counts. JSON bytes include recipe metadata and all table entries. They are serialization costs, not native heap usage or network transfer estimates.

| Selections per scheme | Entries | Unique native objects | JSON bytes |
| --------------------- | ------: | --------------------: | ---------: |
| 9                     |      36 |                    36 |      3,214 |
| 256                   |   1,024 |                 1,024 |    150,865 |

The fixture has distinct token colors for each theme and scheme and distinct declaration combinations. This exercises mostly unique output rather than benefiting from style interning. Reports are written to `bench/results/native-variants/`; raw timing files remain under ignored `bench/results/`.
