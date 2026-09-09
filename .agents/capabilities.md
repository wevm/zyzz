# CSS Capability Inventory

Version 12. This inventory separates accepted authoring from rendered support. The exact property and scalar grammar is owned by `src/internal/Literal.ts`; declarations share that grammar across root, theme, and Config authoring.

## Current Web Surface

| Capability                                                                                      | Types                                                                 | Extraction / emission / maps                                                         | Browser proof                                                 | Benchmark                                      |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------- |
| Layout: display, position, box sizing, flex direction/wrap/alignment/growth, gaps               | Finite properties and enums                                           | Literal scalar values; overlapping gap declarations retain order                     | Existing Style/Css/Transform integration suites               | Literal compilation and module-transform lanes |
| Physical margin/padding and dimensions                                                          | Supported lengths and CSS zero; negative margins and auto where valid | Scalar declarations, shorthand/longhand order; original units retained               | Existing cascade and theme scope integration suites           | Literal/theme compilation lanes                |
| Colors, border style/width/radius, font size/style/weight, line height, text alignment, opacity | Bounded scalar grammar and numeric ranges                             | No general CSS expressions; numeric bounds checked during validation                 | Existing literal and theme scheme integration suites          | Literal/theme compilation lanes                |
| CSS-wide keywords                                                                               | Every supported property                                              | Preserved as literal values                                                          | Existing literal integration suites                           | Literal compilation lanes                      |
| Theme tokens and named configurations                                                           | Exact paths and property domains                                      | Live variables, defining fallbacks, shared scopes, packed metadata and source maps   | Theme scopes and light/dark in Chromium; packed Vite fixtures | Theme, config, and packed graph lanes          |
| Ordered declaration fallbacks                                                                   | Nonempty readonly tuples, independently checked entries               | Dense literal arrays expand in place; each emitted declaration maps to its own entry | Transform fallback browser scenario                           | Fallback transform lane                        |
| Trailing `!` / `!important`                                                                     | String/number suffixes preserve property and token domains            | Importance is separate declaration data; mixed priority and order retained           | Transform fallback browser scenario                           | Fallback transform lane                        |

Supported lengths include absolute, font-relative, viewport-relative (default/small/large/dynamic), and container-relative units, percentages, or numeric zero; border widths exclude percentages. Colors accept hex, transparent, currentColor, black, and white. Full lists and bounds remain in the owning literal rules rather than a second parser definition.

Standard length units share one vocabulary for types and runtime validation. Source-to-CSS snapshots preserve spelling, token fallbacks, importance, and per-entry maps. Browser fixtures compare every unit with directly authored CSS and check viewport/container/font computations. The standard-length transform lane measures the complete source pipeline.

Logical box properties add dimensions, min/max dimensions, block/inline margins and padding, and logical/physical inset offsets. Direction and horizontal/vertical writing-mode enums control browser mapping. `Logical` fixtures cover every added property, source maps, token fallbacks/importance, inherited modes, and ordered A/B/A conflicts; browser validation runs in CI. A logical-box transform benchmark covers 10/100 additional styles.

Logical/physical dimensions share conflict domains only when logical dimensions are authored. Insets share one domain; existing margin/padding domains include their logical forms. Scalar shorthands retain authored order. Multi-value shorthands, sideways writing modes, remain deferred.

Flex layout adds `flexBasis`, `order`, `alignSelf`, and `alignContent`; overflow adds `overflow`/`overflowX`/`overflowY`. Safe integer order is checked at runtime. Flex basis uses the existing length/auto domain and spacing tokens. Overflow declarations share one conflict domain. Source, type, map, browser-layout/scroll, and A/B/A fixtures accompany a 10/100-style transform and delivery benchmark.

Border/outline coverage adds 42 scalar properties: physical/logical side colors, styles and widths; physical/logical corner radii; outline color/style/width/offset. Widths and offsets exclude percentages; radii retain them. Border-specific tokens precede shared colors, radius tokens cover corners, and outlines use shared colors. Border color/style/width/radius each retain overlapping declaration order.

Type, source/map, native-control browser fixtures, A/B/A composition, and 10/100-style transform/delivery lanes cover the expansion. Browser fixtures exercise all new properties across both directions and three writing modes. Combined shorthands, elliptical radii, named widths, border images, and native conversion remain deferred.

Intrinsic sizing adds `fit-content`, `min-content`, and `max-content` to physical/logical dimensions, minimum/maximum dimensions, and flex basis. Minimum dimensions accept `auto`; maximum dimensions accept `none`; flex basis additionally accepts `content`. Types and runtime derive keyword domains from the same rule table. Source/map fixtures cover fallback importance and literal/token precedence; browser fixtures verify content-based widths and flex basis. A 10/100-style transform lane records timing and delivery.

Function forms, `stretch`, and native intrinsic sizing remain deferred. Shared spacing tokens remain lengths and explicit references retain access to keyword-shaped names.

Scroll spacing adds 26 properties: physical/logical scroll margins and padding, scroll behavior, and physical overscroll behavior axes. Scroll margins accept signed lengths without percentages; padding accepts nonnegative lengths/percentages, zero, auto, and spacing tokens. Margin tokens await a length-only domain.

Separate margin, padding, and overscroll conflict domains preserve A/B/A composition. Source/map fixtures cover literal/token precedence and mixed importance. Browser fixtures compare all properties with independent CSS across six writing-mode/direction combinations and exercise scroll-into-view offsets and smooth scrolling. A 10/100-style lane measures full transforms and delivery.

Logical overscroll axes, multi-value shorthands, and native conversion remain deferred. Overscroll checks establish computed declarations; device-specific boundary gestures remain browser behavior.

Scroll snapping adds `scrollSnapType`, `scrollSnapAlign`, and `scrollSnapStop`. Finite enums share type/runtime validation for axes, strictness, and one/two-keyword alignment. Canonical single-space combinations, CSS-wide keywords, fallbacks, and importance retain source locations and authored order; theme tokens do not map to these keyword domains.

Source/map and A/B/A fixtures cover extraction and emission. A real browser fixture compares physical-axis snap positions and always-stop behavior with independent CSS controls, plus computed paired alignment. A 10/100-style lane records complete transform timing and delivery. Proximity heuristics, gesture physics, and native snapping are outside this compiler proof.

Text flow adds ten properties: letter/word spacing, indentation, last-line alignment, text transformation/overflow, whitespace, word breaking, overflow wrapping, and hyphenation. Types and runtime share finite keyword/length domains. Indentation accepts spacing tokens; letter/word spacing exclude percentages and unconstrained spacing references.

Source/map fixtures cover fallback importance, indentation tokens, and rejected domains. Browser fixtures compare emitted declarations with independent CSS controls and check wrapping height, spacing width, overflow, and indentation. A 10/100-style transform lane records delivery and timing. Language dictionaries, extended grammar, typography token scales, and native rendering remain deferred.

Text decorations add six properties: decoration color, line, style, thickness, ink skipping, and underline offset. Line values allow distinct underline/overline/line-through combinations in any order or standalone none. Shared colors map to decoration color; spacing tokens map to thickness and offset. The supported thickness subset is nonnegative; offsets accept signed lengths and percentages.

Source/map and type fixtures cover token domains, line combinations, and fallback importance. Browser fixtures compare all six computed declarations against independent CSS controls across three writing modes and both directions; decoration painting remains browser-owned. A 10/100-style transform lane records timing and delivery. Combined shorthands, underline position, emphasis, shadows, and native rendering remain deferred.

Tables add `borderCollapse`, `borderSpacing`, `captionSide`, `emptyCells`, and `tableLayout`. Shared finite rules preserve keyword domains, nonnegative scalar lengths, fallback priority, and source maps. Border spacing excludes percentages and unconstrained spacing tokens. Two-length spacing, extended caption placement, and native rendering remain deferred.

Browser fixtures compare real table/caption/cell geometry and computed declarations against independent CSS controls in both directions. Explicit checks cover spacing priority, caption placement, and inherited empty-cell visibility. A 10/100-style transform lane measures timing and delivery. Property contracts follow [CSS Tables](https://www.w3.org/TR/CSS22/tables.html).

Interaction adds `cursor`, `pointerEvents`, `resize`, `userSelect`, and `visibility` with finite keyword domains. CSS-wide keywords, fallback importance, and source maps use the existing pipeline. Cursor images, SVG pointer-event values, selection containment, and native rendering remain deferred; these keyword properties accept no theme token groups.

Browser fixtures compare computed declarations with independent CSS controls, exercise pointer hit testing, verify hidden layout preservation, and test text selection. Resize and cursor checks cover computed declarations; platform resize gestures and cursor artwork remain browser-owned. A 10/100-style transform lane measures timing and delivery. Contracts follow [CSS UI](https://www.w3.org/TR/css-ui-4/).

## Upstream Conformance

[CSS conformance](../test/conformance/README.md) pins MDN grammar and tracks every upstream property, function, selector, at-rule, syntax, type, and unit. CI rejects unclassified additions, removals, and changed fingerprints, including indirect grammar changes. Weekly dependency PRs surface upstream updates without live-network checks in normal CI.

Compiler probes exhaust finite keywords and sample scalar boundaries against CSS Tree using current pinned MDN grammar. The same accepted corpus checks public TypeScript property types, with representative inference probes; independent rejected inputs exercise type and source diagnostics. Partial coverage remains explicit. These checks complement browser fixtures and do not establish complete CSS or native support.

## Targets

The pure core validates ordered declarations. The web compiler emits standard CSS and leaves browser lowering to the host. Chromium integration verifies fallback order, priority, shorthand/longhand precedence, and inherited tokens. Vite and Lightning CSS retain ownership of configured browser targets; existing native `light-dark()` fixtures use Chrome 123, Firefox 128, and Safari 17.5 targets.

Newer length units remain native browser syntax; acceptance does not establish support in older browser targets. Container units do not imply authoring support for containment declarations or queries.

A native emitter is not implemented. Neither these web fixtures nor accepted core types establish native rendering support. Native importance, ordered fallbacks, web variables, selectors, and conditions require explicit target diagnostics when that adapter lands.

## Deferred Surface

| Capability                                                  | Current disposition                                    | Plan              |
| ----------------------------------------------------------- | ------------------------------------------------------ | ----------------- |
| Wider property families and functional CSS strings          | Rejected by scalar validation                          | 2.3               |
| Static templates/expressions and `theme.vars`               | Not extracted                                          | 2.3 follow-ups    |
| Registered/explicit variables and dynamic value callbacks   | Not implemented                                        | 2.3 follow-ups    |
| Bundled tokens, typography, media/container thresholds      | Not implemented                                        | 2.4a              |
| Selectors, nesting, and conditional at-rules                | Not extracted or emitted                               | 2.4b              |
| Cascade layer bodies, global rules, keyframes, fonts, reset | Layer names have types only; contributions not emitted | 2.4c              |
| Recipes, responsive selections, multipart styling           | Not implemented                                        | Phase 3 and later |

Quoted/escaped exclamation marks do not become importance markers. String-content properties and CSS functions remain outside the scalar grammar, so this version rejects them rather than claiming string parsing support. Empty, sparse, nested, accessor-backed, spread, and invalid fallback entries produce diagnostics before emission. Runtime inline-style overrides retain their scalar contract.

Update this versioned inventory with type, extraction, emission, mapping, target, integration, and benchmark evidence whenever a capability expands. The numbered union in the plan remains the complete cross-phase backlog.
