# CSS Conformance

Zyzz owns its property/value types. Pinned `mdn-data` and `css-tree` development dependencies provide independent grammar checks; neither ships in client code.

## Validation Contract

CSS authoring relies on static TypeScript validation. Style definitions, theme values, and CSS emission do not execute CSS property/value validators in development or production. Source extraction still diagnoses unsupported executable syntax; ordered data and theme graph checks remain structural requirements.

Consumer probes cover property names, token domains, units, hex literals, integer literals, nonnegative scalar literals, fallbacks, and importance. Broad numbers, custom identifiers, and complex function arguments cannot all be validated by these types. CSS parsing and computed-value semantics belong to the browser.

## Coverage

`coverage.json` classifies every pinned property, function, selector, syntax, type, and unit. `at-rules.json` separately tracks at-rule and descriptor grammars. SHA-256 fingerprints cover complete upstream entries and shared syntaxes. `pnpm check:css` fails on grammar drift or unclassified additions.

| Status       | Meaning                                                                               |
| ------------ | ------------------------------------------------------------------------------------- |
| Supported    | Reviewed complete support with static type, compiler, and applicable browser evidence |
| Partial      | Typed mapping exists with documented grammar or evidence gaps                         |
| Deferred     | Tracked without an implemented property mapping                                       |
| Unclassified | Requires review; CI fails                                                             |

Current property coverage is **0 partial, 0 deferred, and 670 supported** out of 670. Removing runtime validation does not promote entries. A partial property receives no completion credit.

## Evidence

The Transform conformance suite walks the independent grammar and referenced productions to enumerate accepted keywords and samples numeric, color, image, URL, and dimensional domains. Candidate units come from upstream data and are selected by the independent MDN/CSS Tree grammar, never a Zyzz runtime validator.

Every accepted probe checks emitted CSS against independent grammar and compiles a public TypeScript consumer. Invalid probes check expected TypeScript errors, including importance; booleans are rejected for every mapped property. Dedicated fixtures verify browser layout, painting, cascade, inheritance, and theme behavior. The property browser matrix checks every engine-accepted value in the corpus and records counts per property and unsupported spellings in a CI capability artifact. A separate matrix checks shorthand/longhand repeated overrides and reset-only relationships.

Image and URL mappings include background-image, border-image-source, list-style-image, mask-border-source, mask-image, -webkit-mask-image, marker and its longhands, and -moz-binding. Quoted URL fallbacks retain importance. Marker shorthand/longhand conflicts preserve declaration order. Legacy spellings retain static declaration support; unavailable engines are recorded separately. Image-function arguments remain CSS text under the validation contract.

## Completion Gate

`pnpm check:css:full` requires all 670 pinned MDN properties, including vendor and obsolete entries, to be reviewed as supported. Partial, deferred, and unclassified entries receive zero credit. The threshold uses exact counts, not rounded percentages. Grammar drift still fails, and `--update` cannot be combined with the full gate.

The **CSS Property Conformance (100%)** CI job publishes a report even when it fails. Type, grammar, build, and browser checks run alongside it. The ledger records reviewed implementation status; it is not a browser certification. The full gate passes with the reviewed inventory; grammar drift and incomplete future entries still fail.

## Upstream Updates

1. Review the dependency update and changed upstream grammar.
2. Run `pnpm update:css` and `pnpm update:at-rules` to refresh both inventories.
3. Classify additions and update property types and probes as required.
4. Run `pnpm check:css`, `pnpm check:at-rules`, `pnpm check:types`, and the Transform CSS conformance scenarios; run applicable browser fixtures.

Refreshing fingerprints acknowledges upstream changes; it does not implement features or promote coverage. Normal CI uses the lockfile and does not fetch live grammar.

Sources: [MDN data](https://github.com/mdn/data), [CSS Tree](https://github.com/csstree/csstree), [CSS Images](https://www.w3.org/TR/css-images-4/), [SVG Markers](https://www.w3.org/TR/svg-markers/).

## Compound Properties

Every pinned property now has an authoring type, including custom properties, shorthands, font settings, filters, shadows, motion paths, timelines, and legacy spellings. Custom-property case and arbitrary scalar data are preserved. Named CSS properties still reject unknown names, wrong scalar domains, and invalid finite keywords.

The new compound fixture records positive declarations independently of the emitter. Recursive function arguments and open custom identifiers retain CSS text. Argument semantics and open custom identifiers remain browser-owned under the static validation contract. Bounded grammar probes and the complete engine-accepted corpus provide evidence for the modeled property surface.

The grammar oracle supplements the missing `param()` production from CSS Linked Parameters. It corrects the pinned circle production's use of radial-gradient sizing and normalizes SVG 2's path-length range notation. These exceptions are test-only; upstream fingerprints remain checked.

Compositional probes sample upstream grammar alternatives, repetition counts, and component orders with bounded traversal. They complement keyword and scalar probes; they are not an exhaustive enumeration of recursive CSS text. The test oracle also applies the CSS Writing Modes requirement that explicit `text-combine-upright: digits` counts be between two and four.

Authoring helpers accept mixed-case CSS literals and surrounding CSS whitespace while retaining case-sensitive token names. Numeric refinements distinguish CSS decimal and integer tokens from JavaScript radix spellings, preserve signed zero, and retain nonnegative and positive constraints. These refinements exist only in TypeScript.

Compact serialization expands the corpus to 63,752 independently accepted values, each emitted normally and with importance (127,504 declarations). Static lexical probes cover CSS comments, identifier escapes, ASCII keyword folding, and numeric token boundaries. Browser fixtures verify escaped literals and commented importance; CSS Tree does not resolve these escape spellings itself.

## Reviewed Evidence

[bc6e1ca CI](https://github.com/wevm/zyzz/actions/runs/34417051637) passed all 315 integrations, including every engine-accepted corpus value, shorthand resets, escaped literals, and theme/cascade controls. Build, native checks, ordinary TypeScript, macOS host checks, and the benchmark workflow passed. [d2a78d9 CI](https://github.com/wevm/zyzz/actions/runs/34417846641) additionally passed the grid integer and slash-limit type probes, browser regressions, full corpus, and benchmarks. Two unrelated subprocess integrations hit their five-second test limit; the follow-up adds bounded compiler deadlines and an explicit integration-test budget.

The review covers finite keywords and combinations, upstream dimensional units, CSS numeric/hex spelling, scalar ranges, compound entry shapes, token domains, fallbacks, importance, emitted declaration order, and applicable computed styles. Supported means the documented static authoring and emission contract; recursive function arguments, arbitrary identifiers, and browser feature availability retain their stated boundaries.

Grid indexes use nonzero integers, and span counts use positive integers, including signed and zero-padded spellings. The restrictions follow [CSS Grid line placement](https://www.w3.org/TR/css-grid-2/#line-placement); the pinned grammar alone does not exclude zero.

The matched theme/graph integrations took 8.43 seconds before the grid change and 8.38 seconds after it on the same machine. Each TypeScript subprocess now has a ten-second deadline inside a fifteen-second integration budget. The full-coverage arithmetic still rejects 669/670 and stale fingerprints.

## At-rule acceptance

The independent at-rule ledger accounts for 22 top-level rules and 62 descriptors/nested blocks. Implemented entries link evidence; partial remains zero credit toward `check:at-rules:full`. Inventory drift and missing evidence fail the normal gate. No generic-string or parser-passthrough acceptance establishes full grammar support.

The acceptance fixtures cover direct and packed declaration source maps, Unicode and legacy output, nested CSS asset watch updates, descriptor type domains, and real Chromium font loading, counter rendering, animation progress, namespace boundaries, and anchor fallbacks.

CI uploads `at-rule-browser-capabilities.json` for experimental and legacy syntax. A browser accepting a rule is not proof of every descriptor or rendering behavior.

`@charset` now follows the verified UTF-8 output policy. Profile components, composite CSS function signatures, and native paged-output fixtures have landed. The [acceptance review](./at-rule-acceptance.md) and per-entry ledger list the remaining grammar, context, packaging/watch, and rendering gaps. Chromium 153 rejects color profiles; the public helper remains gated. The full-completion command remains red.

Declaration benchmarks measure source transforms with maps and packed consumption at 10/100 families. Existing framework compilation lanes now collect at least 20 samples over one second, with unchanged performance thresholds; the earlier 100ms lanes could be dominated by scheduler stalls.

A local sparse lane collected 612 Zyzz samples at 1.635ms ±1.50%; this is diagnostic evidence, not a cross-machine speed claim.
