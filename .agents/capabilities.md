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

Supported lengths include absolute, font-relative, viewport-relative (default/small/large/dynamic), and container-relative units, percentages, or numeric zero; border widths exclude percentages. Colors accept hex, transparent, currentColor, and all 148 canonical lowercase named colors and 19 canonical system-color keywords. Full lists and bounds remain in the owning literal rules rather than a second parser definition.

Standard length units share one vocabulary for types and runtime validation. Source-to-CSS snapshots preserve spelling, token fallbacks, importance, and per-entry maps. Browser fixtures compare every unit with directly authored CSS and check viewport/container/font computations. The standard-length transform lane measures the complete source pipeline.

Logical box properties add dimensions, min/max dimensions, block/inline margins and padding, and logical/physical inset offsets. Direction and horizontal/vertical writing-mode enums control browser mapping. `Logical` fixtures cover every added property, source maps, token fallbacks/importance, inherited modes, and ordered A/B/A conflicts; browser validation runs in CI. A logical-box transform benchmark covers 10/100 additional styles.

Logical/physical dimensions share conflict domains only when logical dimensions are authored. Insets share one domain; existing margin/padding domains include their logical forms. Scalar shorthands retain authored order. Multi-value shorthands, sideways writing modes, remain deferred.

Flex layout adds `flexBasis`, `order`, `alignSelf`, and `alignContent`; overflow adds `overflow`/`overflowX`/`overflowY`. Safe integer order is checked at runtime. Flex basis uses the existing length/auto domain and spacing tokens. Overflow declarations share one conflict domain. Source, type, map, browser-layout/scroll, and A/B/A fixtures accompany a 10/100-style transform and delivery benchmark.

Border/outline coverage adds 42 scalar properties: physical/logical side colors, styles and widths; physical/logical corner radii; outline color/style/width/offset. Widths and offsets exclude percentages; radii retain them. Border-specific tokens precede shared colors, radius tokens cover corners, and outlines use shared colors. Border color/style/width/radius each retain overlapping declaration order.

Type, source/map, native-control browser fixtures, A/B/A composition, and 10/100-style transform/delivery lanes cover the expansion. Browser fixtures exercise all new properties across both directions and three writing modes. Physical color/style lists accept up to four components; logical block/inline lists accept pairs. Radii support elliptical corner pairs and slash-separated axes in border-radius. Border and outline widths accept thin, medium, and thick. Combined border shorthands, border images, substitution, escaped spellings, and native conversion remain deferred.

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

Quoted/escaped exclamation marks do not become importance markers. Quoted string-content properties remain outside the supported grammar. Functional values use explicit property-domain validators. Empty, sparse, nested, accessor-backed, spread, and invalid fallback entries produce diagnostics before emission. Runtime inline-style overrides retain their scalar contract.

Update this versioned inventory with type, extraction, emission, mapping, target, integration, and benchmark evidence whenever a capability expands. The numbered union in the plan remains the complete cross-phase backlog.

## Column Properties

Twelve properties add column count/width/fill/span, rule color/style/width, before/after/inside breaks, and orphan/widow counts. Column gaps accept `normal`. Counts use positive safe integers; column count also accepts `auto`. Widths exclude percentages. Shared color tokens map to rule colors.

The MDN grammar/type corpus covers accepted domains. Source fixtures preserve fallback priority and maps; a browser fixture compares columns and forced breaks against independent CSS. Shorthands, regions, additional fragmentation keywords, and paged-media rendering remain deferred. Timing and delivery use the column transform lanes.

## Layout and Containment

Ten properties add float clearing, containment, content visibility, isolation, object fitting, backface visibility, box decoration breaks, transform style, and stacking indices. Display adds contents, flow-root, list-item, and table roles. Containment currently accepts single keywords; z-index accepts auto or safe integers.

Independent MDN/type probes cover every accepted keyword. Browser fixtures verify computed declarations, float clearance, and stacking hit tests. Object cropping, 3D painting, containment combinations, multi-keyword display, and native rendering remain separate gates; computed values alone do not prove those behaviors.

## Backgrounds and color controls

Background attachment, blend mode, clipping, origin, repeat, axis positions, and size accept bounded scalar values. Axis positions accept signed lengths/percentages and the corresponding axis keywords; size accepts nonnegative lengths/percentages, auto, contain, or cover. Lists, position pairs, size pairs, images, and gradients remain deferred.

Accent and caret colors accept the shared color domain, color tokens, and auto. Explicit token references disambiguate a color token named auto. Color schemes accept normal, light, dark, light dark, dark light, only light, and only dark. Forced-color adjustment, print-color adjustment, and mix blending use finite keywords. Grammar and type probes cover these domains; browser fixtures compare computed styles with independent CSS. Computed styles do not establish pixel-level blending, clipping, or forced-color rendering.

## SVG Paint

Nineteen properties cover fill/stroke paints, opacity, fill/clip rules, line caps/joins, stroke lengths and miter limits, filter colors, paint order, rendering hints, and non-scaling strokes. Fill and stroke accept scalar colors, shared color tokens, none, context-fill, and context-stroke. Opacities accept finite numbers and percentages, clamped by the browser; miter limits accept finite numbers at least one. Stroke widths use nonnegative lengths/percentages; dash offsets also allow negative values.

Paint order currently accepts normal or a single fill/stroke/markers keyword. Unitless nonzero SVG lengths, paint servers, dash arrays, multi-keyword paint order, and other vector effects remain deferred. Browser evidence compares independent computed styles and verifies evenodd path geometry; it does not prove filter pixels, hint quality, or vector-effect rendering.

## Font Controls

Nineteen properties add font kerning, optical sizing, stretch keywords, synthesis controls, caps/position/east-Asian/ligature/numeric variants, ruby placement/alignment, vertical orientation, text combination, justification, and emphasis. Emphasis colors accept shared color tokens; emphasis shapes support filled/open combinations in either order. Emphasis positioning and ruby positioning use finite keyword combinations.

Numeric, East Asian, and ligature variants accept compatible keyword combinations. Font synthesis accepts independent weight, style, small-caps, and position choices. Conflicting alternatives and repeated groups fail. Stretch percentages, custom emphasis strings, digit-combination counts, and font feature settings remain deferred. Browser fixtures compare independent computed styles and verify ruby annotation placement and upright vertical text geometry; they do not establish font-specific glyph selection or justification quality.

## Motion Controls

Eleven animation and transition properties support comma-separated durations/delays, easing functions, iteration counts, direction, fill mode, play state, and discrete transition behavior. Times use finite decimal or exponent values with s/ms units, including zero; negative delays are accepted, while negative durations are rejected. Animation duration also accepts auto. Iteration counts accept nonnegative numbers or infinite.

Literal cubic-bezier(), steps(), and linear() curves validate argument counts and numeric constraints. Math inside easing arguments, substitution, comments, escaped spellings, animation names, timeline syntax, and keyframe authoring remain deferred. Ordinary CSS can supply animation names and keyframes. A paused-animation fixture verifies computed declarations, native duration/delay, and the opacity produced by a negative delay. Transition interpolation and discrete-transition lifecycle behavior remain separate browser gates.

## Grid Tracks

Nine properties cover implicit tracks, scalar explicit tracks, auto-placement, and row/column start/end lines. Tracks accept nonnegative lengths, percentages, fr dimensions, auto, min-content, and max-content. Explicit tracks also accept none and subgrid. Auto flow accepts row/column with optional dense in either order.

Grid lines accept auto, nonzero safe integers, and span followed by a canonical positive safe integer. Important numeric fallbacks preserve their number domain. Track lists, repeat/minmax/fit-content functions, and track line-name groups are supported as described below. Named-line placement, areas, and grid shorthands remain deferred. Browser fixtures compare independent CSS and verify fractional implicit tracks and a two-column span; subgrid layout remains a separate gate.

## Masks and Positioning

Sixteen properties add mask geometry/mode/composition, scalar mask sizing and positioning, image rendering, object/background positioning, perspective, transform boxes/origins, and shape margins. Scalar positions accept signed lengths/percentages or one bottom/center/left/right/top keyword. Perspective accepts none or nonnegative lengths without percentages. Mask sizing accepts nonnegative lengths/percentages, auto, contain, or cover.

Background position and its X/Y longhands share a conflict domain to preserve authored precedence during CSS factoring. Mask images can be supplied by ordinary CSS; a Chromium fixture compares masked pixels with independent declarations and an unmasked control. Lists, image sources, paired positions/sizes, gradients, filter functions, and 3D transform rendering remain deferred.

## Lists and Input

Thirteen properties add common list marker styles and placement, appearance keywords, touch actions, scrollbar width, overflow anchoring, logical overscroll axes, integer tab sizes, bidi controls, line breaking, text autoscaling keywords, and spacing trim. Touch action enumerates all 94 combinations of the supported gesture keywords, preserving permutations without allowing conflicting directions.

Tab sizes are nonnegative safe integers. Custom counter styles/strings, length-based tab stops, text-size percentages, and broader appearance syntax remain deferred. Chromium fixtures compare native marker pixels, tab layout, and computed controls; touch gesture dispatch, rubber-banding, bidi visual ordering, and text autoscaling behavior remain separate gates.

## Color Keywords

All 148 canonical lowercase CSS named colors and 19 canonical system-color keywords are accepted by color properties and theme values, including paired schemes. Literal names take precedence over inferred token names; explicit theme.tokens references retain access to colliding tokens. The independent MDN corpus exhausts every named color across each color property and consumer type. Browser fixtures verify named RGB values, explicit references, importance, and light/dark scheme changes. Absolute rgb()/rgba(), hsl()/hsla(), hwb(), lab()/lch(), oklab()/oklch(), and predefined color() spaces accept finite literal channels, alpha, and modern none components. Legacy separators retain their restrictions. Relative colors, nested functions, comments, and escaped spellings remain deferred.

## Container and Field Sizing

`containerType` accepts `normal`, `size`, `inline-size`, `scroll-state`, and either size mode combined with `scroll-state` in either order. `fieldSizing` accepts `content` or `fixed`; `interpolateSize` accepts `allow-keywords` or `numeric-only`. Fallbacks and importance use the shared literal pipeline. The inventory tracks 301 partially implemented properties; container names, query authoring, and interpolation functions remain deferred. Browser evidence covers native container-query responses and content-sized inputs; scroll-state queries and animated intrinsic-size interpolation remain separate gates.

## Reading Order

`readingFlow` accepts the seven modes from the pinned CSS Display grammar. `readingOrder` accepts signed safe integers, including zero, with ordered fallbacks and importance. Runtime validation rejects fractions and unsafe integers; TypeScript's number domain cannot express these numeric bounds. Chromium keyboard fixtures compare reversed visual flex flow and explicit ordinal groups with independent native controls and source-order navigation. The inventory now tracks 546 partially implemented properties. Grid traversal, writing-mode interactions, assistive-technology traversal, and cross-browser behavior remain separate gates. See [CSS Display Level 4](https://drafts.csswg.org/css-display-4/#reading-flow).

### Structured Grid Tracks

Explicit and implicit grid tracks accept size lists, `minmax()` and `fit-content()`. Explicit tracks also accept line-name groups and integer or automatic `repeat()`, including fixed-size restrictions for auto-repeat. Repetitions remain compact CSS rather than being expanded by the compiler. The compiler rejects invalid argument counts, flexible minima, nested repetition, and multiple auto-repeat groups. Consumer types constrain the outer value shape; nested grammar is checked during compilation.

Independent MDN grammar probes and native responsive-grid fixtures cover these additions. Additional math functions, variable references, escaped identifiers, and subgrid name repetition remain incomplete; property completion stays partial.

### Box Value Lists

Margin, padding, inset, border-width, scroll-margin, and scroll-padding shorthands accept one to four space-separated scalar components. Their logical block/inline shorthands and gap accept pairs. Each component retains its property-specific auto, percentage, and sign rules; CSS-wide keywords must stand alone. Longhands remain scalar. Type shapes cover lists while the compiler validates arity and every component. Native browser fixtures compare physical longhands in horizontal and vertical writing modes, including importance and shorthand/longhand overrides. Functions, variable substitution, and broader component spellings remain incomplete.

### Math Expressions

Numeric, length, and time properties accept literal calc(), min(), max(), and clamp() expressions. Grid track sizes and length lists retain nested function arguments. Addition requires compatible dimensions; multiplication and division accept scalar factors. Length-percentage mixtures are restricted to properties accepting percentages. Browser evaluation owns range clamping, integer rounding, and unit resolution.

Quoted or escaped substitution, escaped tokens, numeric constants, dimension cancellation, additional math functions, and expressions beyond 128 nested levels remain unsupported. Function names and outer shapes are typed; argument dimensions are checked during compilation. Browser comparisons cover responsive dimensions, radius axes, integer rounding, opacity, and durations.

### Custom-Property References

All mapped properties accept unquoted var() references, including nested and empty fallbacks and variables inside other expressions. Compilation validates balanced components and custom-property names. Property-value matching is deferred until browser substitution, including invalid-at-computed-value behavior. References preserve case and authored spelling; custom properties are supplied by ordinary CSS or native style APIs.

Quotes, escapes, comments, braces, URL tokens, and nesting beyond 128 levels remain outside this subset. Browser fixtures cover inheritance, overrides, cycles, empty fallbacks, importance, and invalid substitutions. These limitations retain partial property status.

SVG geometry, baseline, caret, emoji, font-synthesis-position, logical overflow, scrolling axes, text wrapping, and additional scalar keywords add 38 partial property mappings. Positions allow signed lengths; radii retain nonnegative bounds. Animation composition and scroll timeline axes accept comma lists. Related shorthand and alias domains preserve A/B/A declaration order.

Zoom accepts nonnegative numbers/percentages and normal/reset. Stop opacity accepts finite numbers/percentages with browser clamping. Experimental properties may lack browser implementation; grammar and type coverage do not imply browser support. New SVG geometry and text fixtures compare native computed values and rendered bounds.

Text wrapping, underline position, hanging punctuation, flex flow, position visibility, masonry flow, and speech keywords validate compatible groups. Border/mask image repetition accepts pairs. Timeline axes accept comma lists; interest delays remain scalar. Further baseline, offset, column, fragmentation, and legacy mappings add 44 partial properties. Shorthand and alias domains preserve authored cascade order.

Independent grammar and generated consumer probes cover the expanded map. Browser controls exercise text and flex output; obsolete and experimental declarations retain separate browser limitations. Complete range rules, lexical forms, and associated functional/shorthand grammars remain incomplete.

Eighteen named-value properties add unescaped custom identifiers, dashed names, and comma/space lists. Names preserve case; validation excludes CSS-wide and property-reserved words, enforces standalone keywords, and rejects malformed prefixes or list boundaries. Public string types defer lexical validation to compilation. Quoted names, escaping, comments, and timeline functions remain incomplete.

Browser fixtures resolve case-sensitive keyframes and named container queries. Name grammar follows [CSS Values](https://www.w3.org/TR/css-values-4/#custom-idents), [Containment](https://www.w3.org/TR/css-contain-3/#container-name), [Transitions](https://www.w3.org/TR/css-transitions-1/#transition-property-property), and [Will Change](https://www.w3.org/TR/css-will-change/#will-change). These mappings retain partial status.

Combined border, physical/logical border sides, outline, and column-rule add thirteen partial properties. Values accept one width, style, and color in any order, preserving functional components. Duplicate domains, negative literal widths, and percentages are rejected. When a combined shorthand occurs, related declaration domains remain ordered to preserve longhand overrides.

Browser controls compare both text directions and three writing modes, A/B/A overrides, and the border-image reset performed by border. Independent grammar and consumer probes cover component permutations and functional values. Escaped spellings, broader color functions, and complete numeric forms remain incomplete.

Aspect ratios and transform/translate/rotate/scale add five partial properties. Transform functions validate arity and component dimensions while preserving authored order. Individual transforms accept their respective vector forms. Angle math extends calc/min/max/clamp dimensional checks; percentage depth translations and malformed matrices are rejected.

Browser fixtures compare individual transforms with equivalent function lists, native 3D matrices, rendered bounds, and aspect-ratio sizing. Constants, dimension cancellation, full escaping, and broader numeric spellings remain incomplete. See [CSS Transforms](https://www.w3.org/TR/css-transforms-2/) and [CSS Sizing](https://www.w3.org/TR/css-sizing-4/#aspect-ratio).

Percentage domains support fontWidth, its fontStretch alias, and textSizeAdjust, including nonnegative literals and dimensionally valid math. Zoom accepts percentages. Opacity, fillOpacity, strokeOpacity, floodOpacity, and stopOpacity preserve finite numbers and percentages outside 0–1 for browser clamping. Number/percentage addition remains invalid.

Public source, grammar, type, and browser fixtures cover percentage units, alpha clamping, aliases, importance, and rejection paths. These properties remain partial: escaped numeric spellings, complete tokenization, and broader math still need coverage. See [CSS Color](https://www.w3.org/TR/css-color-4/#transparency), [CSS Fonts](https://www.w3.org/TR/css-fonts-4/#font-width-prop), and [CSS Values](https://www.w3.org/TR/css-values-4/#percentages).

Eighty-two prefixed properties now cover finite keyword domains, lengths, colors, percentages, logical borders, outline radii, line clamping, and scalar mask lists. Public names preserve capitalized prefixes: MozAppearance, MsAccelerator, and WebkitUserSelect. MsScrollbar3dlightColor emits the exact historical -ms-scrollbar-3dlight-color spelling.

WebKit logical-border aliases share conflict domains with standard borders. Independent grammar and consumer probes cover all added mappings; native controls cover logical borders in three writing modes and both directions, text fill/stroke, selection, and repeated alias overrides. Legacy Microsoft/Mozilla platform behavior remains unverified; all entries remain partial.

The percentage browser fixture confirms alpha clamping. Current Chromium ignores font-width and retains the font-stretch fallback; the fixture records that capability and an independent native control. See [legacy logical borders](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/-webkit-border-before) and [text stroke width](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/-webkit-text-stroke-width).

Seventeen corner-shape properties accept canonical curvature keywords, finite superellipse numbers, infinity endpoints, numeric math, and their one/two/four-value shorthands. Additional mappings cover all, grid-gap aliases, font-smooth, justify-items/self, position-try-order, and text-box-edge. Corner aliases share conflict domains; all prevents declaration factoring across reset boundaries.

Source and type probes retain arity and dimension restrictions. Browser fixtures compare bevel hit testing with an independent polygon and verify A/B/A declarations around an all reset. These entries remain partial. Contracts follow [CSS Borders](https://www.w3.org/TR/css-borders-4/#corner-shaping).

Path-length remains deferred: the pinned grammar places its range outside the length production, while [the MDN examples](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/path-length) describe unitless numbers. The independent grammar oracle is unchanged pending clarification of that experimental property.

Fifteen compound-value properties add border/mask image slices, widths and outsets; two scrollbar colors; unbounded legacy Mozilla color lists; hyphenation limits; interest-delay pairs; and comma-separated view-timeline insets. Domains distinguish numeric factors, lengths, percentages, colors, integer counts, and times, with explicit arity and fill-marker placement.

Interest-delay shorthands share conflict domains with start/end longhands. Independent source and consumer probes cover repeated scalar grammar; native controls compare border-image painting and computed scrollbar colors. These entries remain partial. See [CSS Backgrounds](https://www.w3.org/TR/css-backgrounds-3/#border-images), [CSS Masking](https://www.w3.org/TR/css-masking-1/#mask-borders), and [CSS Scrollbars](https://www.w3.org/TR/css-scrollbars-1/#scrollbar-color).
