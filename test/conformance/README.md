# CSS Conformance

Zyzz owns its property/value types. Pinned `mdn-data` and `css-tree` development dependencies provide independent grammar checks; neither ships in client code.

## Validation Contract

CSS authoring relies on static TypeScript validation. Style definitions, theme values, and CSS emission do not execute CSS property/value validators in development or production. Source extraction still diagnoses unsupported executable syntax; ordered data and theme graph checks remain structural requirements.

Consumer probes cover property names, token domains, units, hex literals, integer literals, nonnegative scalar literals, fallbacks, and importance. Broad numbers, custom identifiers, and complex function arguments cannot all be validated by these types. CSS parsing and computed-value semantics belong to the browser.

## Coverage

`coverage.json` classifies every pinned property, function, selector, at-rule, syntax, type, and unit. SHA-256 fingerprints cover complete upstream entries and shared syntaxes. `pnpm check:css` fails on grammar drift or unclassified additions.

| Status       | Meaning                                                                               |
| ------------ | ------------------------------------------------------------------------------------- |
| Supported    | Reviewed complete support with static type, compiler, and applicable browser evidence |
| Partial      | Typed mapping exists with documented grammar or evidence gaps                         |
| Deferred     | Tracked without an implemented property mapping                                       |
| Unclassified | Requires review; CI fails                                                             |

Current property coverage is **670 partial, 0 deferred, and 0 fully supported** out of 670. Removing runtime validation does not promote entries. A partial property receives no completion credit.

## Evidence

The Transform conformance suite walks the independent grammar and referenced productions to enumerate accepted keywords and samples numeric, color, image, URL, and dimensional domains. Candidate units come from upstream data and are selected by the independent MDN/CSS Tree grammar, never a Zyzz runtime validator.

Every accepted probe checks emitted CSS against independent grammar and compiles a public TypeScript consumer. Invalid probes check expected TypeScript errors, including importance; booleans are rejected for every mapped property. Dedicated fixtures verify browser layout, painting, cascade, inheritance, and theme behavior. The property browser matrix checks every engine-accepted value in the corpus and records counts per property and unsupported spellings in a CI capability artifact. A separate matrix checks shorthand/longhand repeated overrides and reset-only relationships.

Image and URL mappings include background-image, border-image-source, list-style-image, mask-border-source, mask-image, -webkit-mask-image, marker and its longhands, and -moz-binding. Quoted URL fallbacks retain importance. Marker shorthand/longhand conflicts preserve declaration order. Legacy browser behavior and complete image-function grammar remain partial.

## Completion Gate

`pnpm check:css:full` requires all 670 pinned MDN properties, including vendor and obsolete entries, to be reviewed as supported. Partial, deferred, and unclassified entries receive zero credit. The threshold uses exact counts, not rounded percentages. Grammar drift still fails, and `--update` cannot be combined with the full gate.

The **CSS Property Conformance (100%)** CI job publishes a report even when it fails. Type, grammar, build, and browser checks run alongside it. The ledger records reviewed implementation status; it is not a browser certification. The full gate intentionally remains failing until the outstanding work is complete.

## Upstream Updates

1. Review the dependency update and changed upstream grammar.
2. Run `pnpm update:css` to refresh fingerprints.
3. Classify additions and update property types and probes as required.
4. Run `pnpm check:css`, `pnpm check:types`, and the Transform CSS conformance scenarios; run applicable browser fixtures.

Refreshing fingerprints acknowledges upstream changes; it does not implement features or promote coverage. Normal CI uses the lockfile and does not fetch live grammar.

Sources: [MDN data](https://github.com/mdn/data), [CSS Tree](https://github.com/csstree/csstree), [CSS Images](https://www.w3.org/TR/css-images-4/), [SVG Markers](https://www.w3.org/TR/svg-markers/).

## Compound Properties

Every pinned property now has an authoring type, including custom properties, shorthands, font settings, filters, shadows, motion paths, timelines, and legacy spellings. Custom-property case and arbitrary scalar data are preserved. Named CSS properties still reject unknown names, wrong scalar domains, and invalid finite keywords.

The new compound fixture records positive declarations independently of the emitter. Recursive function arguments and open custom identifiers retain CSS text. These types do not prove argument semantics or every possible compound permutation; the ledger remains partial pending that review and applicable browser evidence.

The grammar oracle supplements the missing `param()` production from CSS Linked Parameters. It corrects the pinned circle production's use of radial-gradient sizing and normalizes SVG 2's path-length range notation. These exceptions are test-only; upstream fingerprints remain checked.

Compositional probes sample upstream grammar alternatives, repetition counts, and component orders with bounded traversal. They complement keyword and scalar probes; they are not an exhaustive enumeration of recursive CSS text. The test oracle also applies the CSS Writing Modes requirement that explicit `text-combine-upright: digits` counts be between two and four.

Authoring helpers accept mixed-case CSS literals and surrounding CSS whitespace while retaining case-sensitive token names. Numeric refinements distinguish CSS decimal and integer tokens from JavaScript radix spellings, preserve signed zero, and retain nonnegative and positive constraints. These refinements exist only in TypeScript.

Compact serialization expands the corpus to 63,738 independently accepted values, each emitted normally and with importance (127,476 declarations). Static lexical probes cover CSS comments, identifier escapes, ASCII keyword folding, and numeric token boundaries. Browser fixtures verify escaped literals and commented importance; CSS Tree does not resolve these escape spellings itself.
