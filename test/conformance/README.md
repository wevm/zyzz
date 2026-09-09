# CSS Conformance

Zyzz owns its property/value mapping. Pinned `mdn-data` and `css-tree` development dependencies provide an independent check; neither changes the public types or ships in client code.

## Coverage

Run `pnpm check:css` for the traffic-light report. `coverage.json` classifies every upstream property, function, selector, at-rule, syntax, type, and unit. SHA-256 fingerprints include each complete upstream entry; shared syntax changes are checked independently, including changes referenced indirectly by a property.

| Status | Meaning |
| --- | --- |
| 🟢 Supported | Reviewed complete support for the upstream feature, with type/compiler/browser evidence |
| 🟡 Partial | Implemented with deliberate restrictions; see the capability inventory and literal guide |
| ⚪ Deferred | Tracked, with no complete support claim |
| 🔴 Unclassified | Requires an explicit coverage decision; CI fails |

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
