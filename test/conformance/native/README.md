# Native contracts

React Native 0.87.0 defines 387 component/property pairs across View, Text, and Image. `pin.json` fixes upstream sources and hashes. `inventory.json` retains the full declaration and runtime API inventory, including experimental, deprecated, animated, and opaque domains.

`pnpm check:native` also verifies generated static declaration types and validation data. Regenerate with `node scripts/native-conformance.ts --static --update` after reviewing an upstream inventory change. Generated files retain their deterministic printer format and are excluded from repository formatting.

The static projection covers all 157 distinct property names. It resolves the imported image resize domain and excludes `AnimatedNode` and opaque colors from static values. Those host-owned values remain in the full inventory and require dynamic host interoperability. Declaration validation does not establish platform rendering or OS availability.

`check:native:full` remains a failing guard until independent iOS/Android evidence and the remaining universal contracts are complete.
