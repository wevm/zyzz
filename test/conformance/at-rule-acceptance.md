# At-rule Acceptance Review

The current stack does not complete Phase 2.5. The inventory tracks 22 rules and 62 descriptors/nested blocks. `@charset` has a reviewed UTF-8 policy; every other family retains explicit acceptance work. A supported entry cannot retain unresolved gaps, and an incomplete entry must explain its remaining work.

Chromium 153.0.8010.0 rejects `@color-profile`, its `color()` expressions, and the `CSSColorProfileRule` interface. The profile helper remains private. Native PDF output verifies named pages, first/left selectors, counters, and sixteen margin boxes against handwritten CSS; it does not prove printer marks or bleed.

| Rule                   | Status    | Remaining acceptance                                                                                         |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| `@charset`             | supported | UTF-8 policy verified through graph and host output.                                                         |
| `@color-profile`       | partial   | Public descriptor types and real ICC profile rendering, including rendering intents and relative components. |
| `@container`           | partial   | Complete named, style, and scroll-state query contexts and browser behavior.                                 |
| `@counter-style`       | partial   | Descriptor-specific rendering across counter systems, ranges, fallback chains, and speech behavior.          |
| `@custom-media`        | partial   | Native query evaluation and complete query-reference placement.                                              |
| `@document`            | partial   | Legacy-engine rendering and complete matching-function grammar.                                              |
| `@font-face`           | partial   | Descriptor-specific shaping, metrics, variation, and loading behavior.                                       |
| `@font-feature-values` | partial   | Actual font-feature shaping for every nested alias block and font-display behavior.                          |
| `@font-palette-values` | partial   | Palette rendering across named/indexed palettes and override color combinations.                             |
| `@function`            | partial   | Escaped identifiers, list argument refinements, nested function references, and complete permitted contexts. |
| `@import`              | partial   | Browser loading and cascade across layer, supports, and media combinations.                                  |
| `@keyframes`           | partial   | Timeline-range animation rendering and complete stop spelling grammar.                                       |
| `@layer`               | partial   | Complete anonymous/nested context, escaped name, and ordering grammar review.                                |
| `@media`               | partial   | Complete conditional grammar and legal placement review against the pinned inventory.                        |
| `@namespace`           | partial   | Escaped and non-ASCII namespace prefixes and complete placement grammar.                                     |
| `@page`                | partial   | Bleed, printer marks, rotation, fragmentation, and complete page length grammar.                             |
| `@position-try`        | partial   | Complete allowed-declaration/context grammar and fallback rendering combinations.                            |
| `@property`            | partial   | Complete registration syntax/initial-value combinations and associated rendering evidence.                   |
| `@scope`               | partial   | Complete root/limit nesting, specificity, and allowed-context review.                                        |
| `@starting-style`      | partial   | Transition-start rendering and complete style/grouping placement.                                            |
| `@supports`            | partial   | Complete condition grammar and allowed-context review.                                                       |
| `@view-transition`     | partial   | Real navigation/capture behavior and transition-type context coverage.                                       |

## Evidence Added

- `Transform.profile.test.ts`: profile component descriptors, color expressions, packed aliases, asset ownership, source maps, and Unicode output.
- `Host.statements.test.ts`: published UTF-8 bytes and imported stylesheet asset watching.
- `Transform.functionSyntax.test.ts`: composite/repetition syntax, packed defaults, source diagnostics, and emitted JavaScript argument formatting.
- `Transform.functionSyntax.browser.test.ts`: native composite functions, defaults, conditional results, and comma-list arguments.
- `Transform.page.browser.test.ts`: actual PDF page dimensions and drawing-stream parity with independently authored CSS.

The per-entry ledger retains existing evidence links and records remaining gaps. The normal inventory command passes; `pnpm check:at-rules:full` intentionally fails. Phase 3 variants stays after actual full acceptance.

## Matched Benchmark Sample

One paired local run on Node 24.19.0 compared the #101 snapshot with the combined implementation using the unchanged at-rule benchmark corpus. These are compiler timings, not render or selection benchmarks. Positive deltas are slower; the sample does not establish a speed improvement.

| Workload             | #101 mean | Candidate mean | Change |
| -------------------- | --------: | -------------: | -----: |
| Source, 10 families  |  4.297 ms |       4.637 ms |  +7.9% |
| Packed, 10 families  |  4.023 ms |       4.159 ms |  +3.4% |
| Source, 100 families | 33.819 ms |      35.381 ms |  +4.6% |
| Packed, 100 families | 76.126 ms |      79.811 ms |  +4.8% |

Reported relative margins of error ranged from 3.18% to 5.87%. Raw reports remain under ignored `bench/results/`. Existing CI thresholds remain unchanged.
