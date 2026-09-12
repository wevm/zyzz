# At-rule Acceptance Review

Phase 2.5 remains incomplete. The inventory tracks 22 rules and 62 descriptors/nested blocks. `@charset` has a reviewed UTF-8 policy, and `@namespace` has source, packed, map, watch, and native selector evidence. Other families retain explicit acceptance work. A supported entry cannot retain unresolved gaps.

Chromium 153.0.8010.0 rejects `@color-profile`, its `color()` expressions, and the `CSSColorProfileRule` interface. The profile helper remains private. Native PDF output verifies named pages, first/left selectors, counters, and sixteen margin boxes against handwritten CSS; it does not prove printer marks or bleed.

| Rule                   | Status    | Remaining acceptance                                                                                                                           |
| ---------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `@charset`             | supported | UTF-8 policy verified through graph and host output.                                                                                           |
| `@color-profile`       | partial   | Public descriptor types and real ICC profile rendering, including rendering intents and relative components.                                   |
| `@container`           | partial   | Complete named, style, and scroll-state query contexts and browser behavior.                                                                   |
| `@counter-style`       | partial   | Descriptor-specific rendering across counter systems, ranges, fallback chains, and speech behavior.                                            |
| `@custom-media`        | partial   | Native query evaluation and complete query-reference placement.                                                                                |
| `@document`            | partial   | Legacy-engine rendering and complete matching-function grammar.                                                                                |
| `@font-face`           | partial   | Descriptor-specific shaping, metrics, variation, and loading behavior.                                                                         |
| `@font-feature-values` | partial   | Actual font-feature shaping for every nested alias block and font-display behavior.                                                            |
| `@font-palette-values` | partial   | Descriptor grammar/types, CPAL metadata, root-dependent values, contexts, and watch acceptance.                                                |
| `@function`            | partial   | Escaped identifiers, list argument refinements, nested function references, and complete permitted contexts.                                   |
| `@import`              | partial   | Browser loading and cascade across layer, supports, and media combinations.                                                                    |
| `@keyframes`           | partial   | Timeline-range animation rendering and complete stop spelling grammar.                                                                         |
| `@layer`               | partial   | Complete anonymous/nested context, escaped name, and ordering grammar review.                                                                  |
| `@media`               | partial   | Complete conditional grammar and legal placement review against the pinned inventory.                                                          |
| `@namespace`           | supported | Unicode/escaped prefixes, last bindings, default/empty namespaces, import ordering, packed maps, watch updates, and native selector isolation. |
| `@page`                | partial   | Bleed, printer marks, rotation, fragmentation, and complete page length grammar.                                                               |
| `@position-try`        | partial   | Complete allowed-declaration/context grammar and fallback rendering combinations.                                                              |
| `@property`            | partial   | Complete registration syntax/initial-value combinations and associated rendering evidence.                                                     |
| `@scope`               | partial   | Complete root/limit nesting, specificity, and allowed-context review.                                                                          |
| `@starting-style`      | partial   | Transition-start rendering and complete style/grouping placement.                                                                              |
| `@supports`            | partial   | Complete condition grammar and allowed-context review.                                                                                         |
| `@view-transition`     | partial   | Real navigation/capture behavior and transition-type context coverage.                                                                         |

## Evidence Added

- `Transform.namespace.test.ts`, `Host.namespace.test.ts`, and `namespace.test-d.ts`: CSS identifier spellings, repeated declarations, URI string encoding, source and packed diagnostics, map attribution, watch updates, and Chromium comparison with independently authored namespace stylesheets. Existing `vite/statements.test.ts` covers production prolog ordering and source-map composition.

- `Transform.fontPalette.test.ts`: packed palette aliases and maps, conflicting identities, and native color-font screenshot comparisons for indexes, light/dark fallback, out-of-range fallback, repeated overrides, alpha, wide-gamut colors, and multi-family palettes. `vite/statements.test.ts` verifies family-list preservation with unminified CSS, esbuild, and Lightning CSS.

The pinned parser drops multi-family palette descriptors. Compiler and Vite transport now protect the palette rule through parsing and restore its original at-keyword afterward. This preserves its descriptors and identity checks. Palette grammar/type validation, CPAL metadata selection, root-dependent values, contexts, and watch acceptance remain open.

Namespace grammar was reviewed against [CSS Namespaces Level 3](https://www.w3.org/TR/css-namespaces-3/) and [CSS Syntax Level 3](https://www.w3.org/TR/css-syntax-3/). Bindings remain module-owned; the last declaration of each decoded prefix applies throughout its module. URI strings, including the empty string, remain identities rather than fetched assets.

- `Transform.profile.test.ts`: profile component descriptors, color expressions, packed aliases, asset ownership, source maps, and Unicode output.
- `Host.statements.test.ts`: published UTF-8 bytes and imported stylesheet asset watching.
- `Transform.functionSyntax.test.ts`: composite/repetition syntax, packed defaults, source diagnostics, and emitted JavaScript argument formatting.
- `Transform.functionSyntax.browser.test.ts`: native composite functions, defaults, conditional results, and comma-list arguments.
- `Transform.page.browser.test.ts`: actual PDF page dimensions and drawing-stream parity with independently authored CSS.

The per-entry ledger retains existing evidence links and records remaining gaps. The normal inventory command passes; `pnpm check:at-rules:full` intentionally fails. Phase 3 variants stays after actual full acceptance.

## Matched Benchmark Sample

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
