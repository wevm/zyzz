# Native Contracts

React Native 0.87.0 supplies two declaration surfaces. The legacy inventory retains 387 component/property pairs. The published package exposes 403 pairs, including more Image properties. `static-inventory.json` records their union of 421 pairs across 157 distinct properties. No deprecated or host capability is removed from the inventory.

`pin.json` fixes source hashes, the published package URL, and its archive hash. `upstream/Published*.d.ts.txt` preserves the default package declarations and overrides. `inventory.json` retains the legacy declarations and six runtime StyleSheet APIs, including animated and opaque domains.

`pnpm check:native` verifies hashes and generated static types, validation data, and inventory drift. Regenerate with `node scripts/native-conformance.ts --static --update` after reviewing upstream changes. Generated files retain deterministic printer formatting. `check:native:full` still fails until universal application, host interoperability, and independent device evidence are complete.

## Static Evidence

- [Property vectors](../../fixtures/native/StaticValues.ts) cover every distinct property through source extraction and both explicit native platforms.
- [Compiler fixtures](../../../src/react-native/StyleSheet.test.ts) cover destination overrides, structured values, transforms, colors, fonts, shadows, immutable output, and rejection paths.
- [Consumer types](../../../src/react-native/StyleSheet.test-d.ts) cover destination domains, structured keys, origin tuples, and platform-dependent Image overflow compatibility.
- [Graph fixtures](../../../src/compiler/Graph.test.ts) cover immutable source imports, re-exports, packed contracts, and web variant rendering.
- Color conversion uses independent Chromium pixels and the pinned React Native color normalizer. Published-package type checking was also run against `react-native@0.87.0`, with compiled tables assigned to its View, Text, and Image style props.

Published static domains take precedence over legacy domains for shared property names. Legacy-only properties remain available. Native transforms require one operation per entry. Animated nodes and opaque color objects are excluded from static serialization and remain host interoperability work.

## Published Package Type Check

From the repository root, unpack the archive identified by `pin.json` into `.fixture-native-upstream/node_modules/react-native` and verify its SHA-256. Copy [the consumer](consumer.ts.txt) to `.fixture-native-upstream/consumer.ts`, then create this `tsconfig.json` in that directory:

```json
{
  "extends": "../tsconfig.json",
  "files": ["consumer.ts"],
  "include": [],
  "exclude": []
}
```

Run `pnpm exec tsc --noEmit --project .fixture-native-upstream/tsconfig.json`. The consumer assigns the compiled property vectors to the package's actual View, Text, and Image style props. It also checks animated values, interpolation nodes, and opaque platform/dynamic colors through runtime callables and composition against the published component types. These are compile-time checks. No React Native runtime or host registration is executed.

## Platform Limits

Native branches preserve destination semantics. Declaration acceptance does not establish that a property renders on every OS or architecture. The pinned declarations retain platform comments, including iOS border curves and Android elevation. Native font availability, text scaling, RTL resolution, experimental backgrounds, filter/shadow support, and device defaults need independent renderer controls.

Common native branches do not infer device capabilities. Explicit `ios` and `android` overrides select platform input. The later device audit must record OS versions, renderer architecture, fonts, density, and visual tolerances without filtering this inventory.
