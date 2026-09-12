# At-rule Acceptance Review

The compiler matrix reviews all 22 rules and 62 descriptor/nested entries. Every compiler obligation names public type fixtures, source/packed integrations, source maps, reference behavior, or real Host watch tests. Rendering and target compatibility retain their independent incomplete states.

The completion pass adds descriptor validation before output-parser recovery, public color-profile and native property-registration authoring, relative page lengths and calculations, Unicode/escaped function syntax, nested calls, and static list-argument checks. No inventory entries or gate assertions are removed.

Chromium 153.0.8010.0 rejects `@color-profile`, its `color()` expressions, and `CSSColorProfileRule`. The public profile helper preserves valid CSS for compatible targets. WeasyPrint 70.0 verifies basic ICC painting, bleed geometry, and printer marks. Relative ICC colors, rendering intents, complete page rotation/fragmentation, and other per-renderer reviews remain open.

## Acceptance Contract

The acceptance model separates compiler correctness, target compatibility, and rendering evidence. This is an explicit revision of the former combined gate. It follows the distinction between authoring tools and rendering user agents in [CSS conformance](https://www.w3.org/TR/css-2025/#conformance).

`at-rule-matrix.json` accounts for the same 22 rules and 62 descriptor/nested entries. Every entry retains its pinned grammar fingerprint and nine compiler obligations: contexts, grammar, maps, output, packed, references, source, types, and watch. Unreviewed obligations remain gaps; existing smoke tests do not automatically establish complete acceptance.

Each target records compatibility (`native`, `partial`, `unsupported`, or `unreviewed`) separately from rendered evidence (`verified`, `partial`, or `unverified`). An unsupported renderer never counts as rendered support. A compiler claim cannot clear a renderer gap, and renderer availability cannot clear a compiler gap.

| Command                           | Contract                                                                                                                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check:at-rules`             | Validate inventory drift, all matrix obligations, grammar fingerprints, and evidence paths.                                                                                                                 |
| `pnpm check:at-rules:full`        | Require every compiler obligation, then run public type checking and all named integration evidence. The matrix reviews 22/22 rules and 62/62 descriptors; completion requires the fresh execution to pass. |
| `pnpm check:at-rules:rendering`   | Require a fully verified renderer for every entry, then execute named evidence. Currently fails.                                                                                                            |
| `pnpm check:at-rules:targets`     | Require every listed target to have reviewed compatibility and passing probe evidence. Currently fails.                                                                                                     |
| `pnpm check:at-rules:legacy-full` | Preserve the original combined acceptance gate and unresolved gaps. Currently fails.                                                                                                                        |

CI runs the matrix against the actual integration JSON report. Required tests must appear by exact file and full test name with a passing result; skipped or absent cases fail verification. Type evidence remains checked by the repository TypeScript job. Full acceptance always creates a fresh integration run.

The matrix now includes every family, with descriptor-specific grammar and shared source/packed/watch cases. The original combined ledger retains its renderer gaps. Phase 2 and Phase 3's prerequisite remain open until all compiler obligations and target reviews are complete.

## Print Engine Setup

Install [WeasyPrint 70.0](https://doc.courtbouillon.org/weasyprint/stable/api_reference.html#css), its pinned Python dependencies, Pango, and Poppler. Ubuntu setup matches the Verify workflow:

```sh
sudo apt-get install libpango-1.0-0 libpangoft2-1.0-0 poppler-utils
python -m venv .venv
.venv/bin/python -m pip install -r test/conformance/requirements.txt
WEASYPRINT_EXECUTABLE="$PWD/.venv/bin/weasyprint" pnpm test run src/compiler/Transform.print.test.ts
```

The TypeScript adapter checks the exact renderer version, creates temporary PDFs, and rasterizes with `pdftoppm`. Python packages are pinned; system Pango/Poppler versions follow the runner image. Comparisons use compiled and independently authored CSS on the same engine, with geometry and non-rendering controls.

The ICC fixture is an embedded sRGB profile generated by LittleCMS, without network assets. The test verifies the PDF's embedded profile bytes, ICC-based color space, and red raster output. A relative-color control remains blank, and the capability artifact records rendering intent as unverified. These findings do not establish complete `@color-profile` support.

## Evidence Added

- Profile templates retain opaque prior substitutions during color-space position validation; a real theme variable survives the relative-color origin through packed output. Token objects remain restricted to their existing direct-value contexts.

- Integer-only function arguments reject fractional, exponent, dimension, and percentage tokens in source and packed calls. Composite signatures retain declared dimensional and keyword alternatives. Widened signatures and newly added primitives publish contract version 11; only the fixed legacy scalar subset keeps version 10. New namespace contracts also use version 11, including Unicode/escaped or repeated prefixes and control-character URI transport. Existing version-10 namespace libraries remain readable. Repeated number alternatives accept a scalar fraction as a one-item list. Image results include both URL and gradient domains in public property compatibility checks. Unbounded results are rejected by bounded shorthands; comma-list outputs require explicit list metadata, and custom properties retain open token-list output. Space-repeated transform-function results are accepted by `transform`; incompatible or unproven result domains remain type errors. Extended identifier signatures use version 12.

- `Transform.page.test.ts` and `Host.page.test.ts`: every margin box survives a packed library dependency, maps to its owning source call, and replaces its contents during a real host watch update. Public type probes and independent PDF comparisons complete the sixteen nested-block entries. Removing each box separately changes the PDF drawing stream. The parent `@page` rule remains partial.

- `Transform.viewTransition.browser.test.ts`: a real HTTP server and same-origin link navigation exercise packed CSS alongside independently authored native CSS. Successful capture activates both declared transition types and generated transition images; a narrower viewport disables capture through the authored media condition. Descriptor grammar/type validation and watch acceptance still block promotion.

- `Transform.namespace.test.ts`, `Host.namespace.test.ts`, and `namespace.test-d.ts`: CSS identifier spellings, repeated declarations, URI string encoding, source and packed diagnostics, map attribution, watch updates, and Chromium comparison with independently authored namespace stylesheets. Existing `vite/statements.test.ts` covers production prolog ordering and source-map composition.

- `Transform.fontPalette.test.ts`: packed palette aliases and maps, conflicting identities, and native color-font screenshot comparisons for indexes, light/dark fallback, out-of-range fallback, repeated overrides, alpha, wide-gamut colors, and multi-family palettes. `vite/statements.test.ts` verifies family-list preservation with unminified CSS, esbuild, and Lightning CSS.

The pinned parser drops multi-family palette descriptors. Compiler and Vite transport now protect the palette rule through parsing and restore its original at-keyword afterward. This preserves its descriptors and identity checks. Palette grammar/types, absolute-color restrictions, contexts, and watch updates have compiler evidence. Broader CPAL metadata and per-renderer behavior remain separate reviews.

Namespace grammar was reviewed against [CSS Namespaces Level 3](https://www.w3.org/TR/css-namespaces-3/) and [CSS Syntax Level 3](https://www.w3.org/TR/css-syntax-3/). Bindings remain module-owned; the last declaration of each decoded prefix applies throughout its module. URI strings, including the empty string, remain identities rather than fetched assets.

- `Transform.profile.test.ts`: profile component descriptors, color expressions, packed aliases, asset ownership, source maps, and Unicode output.
- `Host.statements.test.ts`: published UTF-8 bytes and imported stylesheet asset watching.
- `Transform.functionSyntax.test.ts`: composite/repetition syntax, packed defaults, source diagnostics, and emitted JavaScript argument formatting.
- `Transform.functionSyntax.browser.test.ts`: native composite functions, defaults, conditional results, and comma-list arguments.
- `Transform.page.browser.test.ts`: actual PDF page dimensions and drawing-stream parity with independently authored CSS.

The per-entry ledgers retain existing evidence and remaining gaps. Inventory and matrix validation pass; rendering, target, and legacy completion commands remain red while their requirements remain open. Phase 3 variants stays after actual full acceptance.

## Compiler Validation Cost

Two matched pairs compare the preceding PR tree (`5484d53`, local equivalent `b756fd5`) against this completion pass on Node 24.19.0 and Vitest 4.1.9. Both use the same dependencies and unchanged benchmark corpus, without concurrent heavy jobs. Additional grammar and descriptor validation increases compilation time; no benchmark thresholds changed.

| Workload             | Previous PR mean | Completion mean |  Change |
| -------------------- | ---------------: | --------------: | ------: |
| Source, 10 families  |         4.608 ms |       10.964 ms | +138.0% |
| Packed, 10 families  |         6.144 ms |       17.104 ms | +178.4% |
| Source, 100 families |        35.725 ms |      104.280 ms | +191.9% |
| Packed, 100 families |        78.917 ms |      222.718 ms | +182.2% |

The table reports the second pair. Candidate relative error is 2.48–4.03%; baseline error is 2.50–10.34%. The first pair also showed increases in every lane. These costs affect compilation and packed consumption, not runtime style selection. `css-tree` 3.2.1 moves from development-only to compiler runtime dependencies; core authoring remains parser-free.

Reproduce on each tree with `node_modules/.bin/vp test bench src/compiler/Transform.atRules.bench.ts --run --no-file-parallelism --outputJson bench/results/gate.json`. Raw reports remain in ignored `bench/results/gate-{baseline,candidate}{,-repeat}.json` within their respective worktrees.

## Matched Benchmark Sample

The namespace-version and repeated-parameter review fixes were measured against `4f58dd9` with Vitest 4.1.9 on the same runner and dependencies. A per-prefix legacy scan increased the ten-selector packed mean by 12–15% in two samples; the final writer instead publishes all namespace metadata as version 11. Its packed mean was 1.3504 ms (741 samples, ±2.61%), versus the repeated baseline of 1.2749 ms (±2.34%), a 5.9% increase. Source means were 1.0324 ms (969 samples, ±7.14%) versus 0.8708 ms (±2.57%), an 18.6% increase. These samples do not establish a speed improvement. Reproduce with `vp test bench src/compiler/Transform.namespace.bench.ts --run --no-file-parallelism -t '10 selectors' --outputJson bench/results/contract.json`; no thresholds changed.

The review fixes were measured against the preceding print-harness commit on the same runner and dependencies. At-rule source means changed 4.387 → 4.288 ms for ten families and 37.187 → 32.263 ms for 100; the latter baseline had ±13.7% uncertainty. Packed means changed 3.891 → 3.976 ms (+2.2%) and 77.660 → 77.748 ms (+0.1%). These samples do not establish a speed improvement.

The print-harness follow-up also avoids at-keyword scanning for stylesheets without an `@` byte and skips irrelevant descriptor rewrites. A paired local run against the preceding #107 tree used the same dependencies, fixtures, and runner, without concurrent benchmark jobs. No size or timing thresholds changed.

| Workload                     | Previous #107 mean | Candidate mean | Change |
| ---------------------------- | -----------------: | -------------: | -----: |
| Unique padding, 1,000 styles |          11.147 ms |      10.651 ms |  -4.4% |
| Palette source, 10           |           2.006 ms |       1.755 ms | -12.5% |
| Palette packed, 10           |           1.983 ms |       1.884 ms |  -5.0% |
| Palette source, 100          |          12.246 ms |      11.792 ms |  -3.7% |
| Palette packed, 100          |          18.320 ms |      16.451 ms | -10.2% |

These samples have 1.6–5.0% relative error and do not establish a general speed advantage. Unique-padding compilation is an unchanged comparison control and does not exercise the at-rule adapter. The comparison predates merging the newer namespace-style changes from main. Reproduce with `vp test bench bench/Compilation.bench.ts src/compiler/Transform.fontPalette.bench.ts --run --no-file-parallelism -t 'unique.*(zyzz|tailwind)|font palette publication' --outputJson bench/results/print.json`.

The namespace/palette completion slice uses additional matched 10/100-item source and packed workloads. On Node 24.19.0, namespace source means were 2–7% lower; the 100-selector packed mean was 12% lower. The 10-selector packed sample was 56% higher with ±23.5% uncertainty; an earlier candidate sample was 3.5% lower. These timings do not establish a speed improvement.

Protecting palette family lists increased the 100-palette source mean from 10.64 ms to 12.07 ms (+13.4%). Packed means increased from 1.53 to 1.94 ms for ten palettes (+27.2%) and from 14.32 to 17.62 ms for 100 palettes (+23.0%), with candidate uncertainties of ±2.5–3.3%. No thresholds changed.

Reproduce with `vp test bench src/compiler/Transform.namespace.bench.ts src/compiler/Transform.fontPalette.bench.ts --run --no-file-parallelism --outputJson bench/results/phase2.json`. Baseline source is the final #106 tree; both revisions use the same fixture files and installed dependencies. Raw reports remain in ignored `bench/results/`.

One paired local run on Node 24.19.0 compared the #101 snapshot with the combined implementation using the unchanged at-rule benchmark corpus. These are compiler timings, not render or selection benchmarks. Positive deltas are slower; the sample does not establish a speed improvement.

| Workload             | #101 mean | Candidate mean | Change |
| -------------------- | --------: | -------------: | -----: |
| Source, 10 families  |  4.297 ms |       4.637 ms |  +7.9% |
| Packed, 10 families  |  4.023 ms |       4.159 ms |  +3.4% |
| Source, 100 families | 33.819 ms |      35.381 ms |  +4.6% |
| Packed, 100 families | 76.126 ms |      79.811 ms |  +4.8% |

Reported relative margins of error ranged from 3.18% to 5.87%. Raw reports remain under ignored `bench/results/`. Existing CI thresholds remain unchanged.
