# CSS Conformance

Zyzz owns its property/value mapping. Pinned `mdn-data` and `css-tree` development dependencies provide an independent check; neither changes the public types or ships in client code.

## Coverage

Run `pnpm check:css` for the traffic-light report. `coverage.json` classifies every upstream property, function, selector, at-rule, syntax, type, and unit. SHA-256 fingerprints include each complete upstream entry; shared syntax changes are checked independently, including changes referenced indirectly by a property.

| Status          | Meaning                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| 🟢 Supported    | Reviewed complete support for the upstream feature, with type/compiler/browser evidence  |
| 🟡 Partial      | Implemented with deliberate restrictions; see the capability inventory and literal guide |
| ⚪ Deferred     | Tracked, with no complete support claim                                                  |
| 🔴 Unclassified | Requires an explicit coverage decision; CI fails                                         |

Current properties are conservatively partial: Zyzz's bounded values are not the entire CSS grammar. Other families remain deferred as whole features, including units whose use is already partially exercised through property probes. The integration check requires exact agreement between implemented properties and supported/partial inventory entries.

## Values and Types

The Transform integration suite compiles every finite keyword and samples colors, numbers, and lengths through root authoring, fallback arrays, importance, and CSS emission. CSS Tree validates emitted values against the pinned MDN properties and referenced syntaxes, overriding its older bundled grammar. Unknown grammar fails rather than silently skipping validation.

Length candidates combine MDN units with CSS Tree's unit vocabulary. Every accepted probe is checked against public `Style.Properties`; representative fallbacks also check inferred `css` calls. Independent invalid/unsupported cases check runtime rejection and expected type errors, including importance. Existing token inference fixtures and native-CSS browser comparisons remain required.

Numeric bounds and hex-digit validity remain runtime checks where public TypeScript templates are broader. The corpus exhausts finite keywords, but samples infinite numeric/string domains. Grammar conformance does not establish browser support or rendering equivalence; browser integration remains separate. No blanket claim of complete CSS conformance is made.

## Upstream Updates

Dependabot opens weekly grouped PRs for MDN data, CSS Tree, and its type declarations. Normal CI uses the lockfile and does not fetch live grammar. Upstream changes fail the inventory check until reviewed.

1. Inspect the dependency update and upstream changes.
2. Run `pnpm update:css` to refresh fingerprints. New entries remain unclassified; existing classifications are retained for review.
3. Review every changed entry and explicitly classify additions in `coverage.json`. Grammar changes can require narrower values, new support, or documented partial coverage.
4. Run `pnpm check:css`, `pnpm check:types`, and `pnpm exec vp test run src/compiler/Transform.test.ts -t 'CSS conformance'`.

Refreshing fingerprints acknowledges upstream changes; it does not implement features or promote coverage. Review updated grammars before accepting that diff. Removal and renaming are also reported. Broader browser tests run in CI.

Sources: [MDN data](https://github.com/mdn/data), [CSS Tree](https://github.com/csstree/csstree), [Zyzz capabilities](../../.agents/capabilities.md).

## Completion Gate

`pnpm check:css:full` requires every property in the pinned MDN inventory to be reviewed as supported. Partial, deferred, and unclassified entries receive zero completion credit. The threshold uses exact counts, not rounded percentages. Grammar drift still fails even if all statuses say supported; `--update` cannot be combined with the strict gate.

The dedicated **CSS Property Conformance (100%)** CI job publishes a summary and downloadable report, including every incomplete property, even when the command fails. It runs alongside type, build, grammar, and browser integration checks. Its scope is the 670 pinned properties, including vendor-prefixed and obsolete entries; the other CSS feature families remain visible in the report but are not silently added to the property denominator.

The status inventory is a reviewed completion ledger, not a browser certification or proof derived from test counts. A property may be promoted only after its grammar, public typing, emitted declarations, and browser behavior have been reviewed against independent evidence. Relabeling entries does not implement them. The existing grammar/type/browser integration jobs must also pass.

Current completion is 0/670 (0%): 555 partial and 115 deferred. This intentionally leaves the consolidated implementation PR blocked. All remaining implementation and evidence work stays in that PR until the full gate passes.

Motion lists preserve comma grouping inside `cubic-bezier()`, `steps()`, and `linear()`. Independent grammar probes, consumer types, and browser comparisons cover numeric restrictions, list ordering, importance, and paused animation output. Substitution, comments, and escaped spellings remain incomplete. Easing semantics follow [CSS Easing Functions](https://www.w3.org/TR/css-easing-2/).

Absolute functional colors are checked across color properties and public types, with theme, inheritance, importance, and SVG browser comparisons. Literal channel ranges retain browser clamping; malformed units, legacy separator mixing, and invalid arity fail. Relative colors and nested expressions remain incomplete. Source: [CSS Color](https://www.w3.org/TR/css-color-4/).

Border color/style shorthands validate component counts without splitting functional colors. Width keywords and elliptical radius axes have independent grammar and type probes; browser comparisons cover physical/logical expansion and important shorthand precedence. Combined border shorthands, substitution, and math remain incomplete.

Font variant and containment keyword groups reject conflicting alternatives and repeated groups. The font-synthesis shorthand adds one partially implemented property. Independent grammar, public types, and native computed-value comparisons cover authored order; font-specific glyph formation and substitution remain incomplete.

Math probes cover calc(), min(), max(), and clamp() for number, length, time, and track domains. Independent grammar checks are paired with invalid-dimension cases and browser evaluation; emitted expressions retain browser clamping and integer rounding. Variable substitution, constants, dimension cancellation, and other math functions remain incomplete. Source: [CSS Values and Units](https://www.w3.org/TR/css-values-4/#calc-type-checking).

Unquoted var() references have public type probes for every mapped property, independent token parsing, and native browser substitution tests. CSS Tree property matching cannot resolve variables; these values receive separate declaration-structure and browser evidence. Empty fallback, cycles, inheritance, and invalid-at-computed-value behavior are covered. Quotes, escapes, comments, URLs, and full tokenization remain incomplete. Source: [CSS Custom Properties](https://www.w3.org/TR/css-variables-1/#using-variables).

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

Theme authoring constrains its generic to the property contract before refining concrete literals. Extracted Parameters remain usable without comparing an impossible arbitrary-key intersection. A standalone consumer probe fell from 14.81 seconds to 5.97 seconds; the alias integration passed in 7.28 seconds. Its 10-second subprocess and 15-second integration limits remain unchanged.

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

Intrinsic size overrides and font-size-adjust accept optional component prefixes with dimension and arity checks. Intrinsic shorthand and physical/logical longhands share a cascade conflict domain. Native controls exercise contained sizing. These six properties remain partial pending complete lexical and browser evidence.

Grid row, column, and area shorthands accept slash-separated placement lines. Named indices and spans extend all four placement longhands; nonzero indices, positive spans, reserved names, and component limits are checked. Placement declarations share a conflict domain. These three new mappings remain partial.
