# CSS Capability Inventory

Version 1. This inventory separates accepted authoring from rendered support. The exact property and scalar grammar is owned by `src/internal/Literal.ts`; declarations share that grammar across root, theme, and Config authoring.

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

Supported lengths are finite px/rem/em/vh/vw/% or numeric zero; border widths exclude percentages. Colors accept hex, transparent, currentColor, black, and white. Full lists and bounds remain in the owning literal rules rather than a second parser definition.

## Targets

The pure core validates ordered declarations. The web compiler emits standard CSS and leaves browser lowering to the host. Chromium integration verifies fallback order, priority, shorthand/longhand precedence, and inherited tokens. Vite and Lightning CSS retain ownership of configured browser targets; existing native `light-dark()` fixtures use Chrome 123, Firefox 128, and Safari 17.5 targets.

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
