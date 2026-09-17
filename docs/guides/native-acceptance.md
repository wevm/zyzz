# Native Acceptance

Static shared authoring compiles through source graphs, file builds, and source-free packages. These checks establish compiler, delivery, and callable behavior. They do not establish iOS or Android layout or rendering parity.

| Boundary          | Evidence                                                          | Verified behavior                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source graph      | `src/compiler/Graph.test.ts`                                      | Imported configuration, barrels, token edits, explicit scheme/platform selection, and composition                                                                |
| File host         | `src/node/Host.test.ts`                                           | Native module/maps output, unchanged builds, imported edits, error preservation, and watch recovery                                                              |
| Packed contracts  | `src/compiler/Graph.test.ts`                                      | Web/native publishers, version 21 static recipes, consumer selection, malformed metadata, and re-exports                                                         |
| Consumer package  | `test/fixtures/UniversalLibrary.ts`, `src/compiler/Graph.test.ts` | Actual npm archive without authoring source, independent web/native entry declarations, browser computed styles against plain CSS, and native callable execution |
| Export precedence | `src/compiler/Native.test.ts`                                     | Explicit local exports take precedence over packed star re-exports                                                                                               |

## Reproduction

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm exec vp test src/compiler/Graph.test.ts src/compiler/Native.test.ts src/node/Host.test.ts --run
pnpm check:types
```

Tests use the repository-pinned toolchain and Chromium from Playwright. Package fixtures compile declarations with the installed TypeScript, pack archives offline, and execute native callables in Node.js. The public graph/host type fixtures also cover invalid native contexts.

`Graph.bench.ts` adds cold native source compilation, unchanged graph reuse, and packed consumption to the Benchmarks workflow. No local timing claim or regression threshold is established by these scenarios.

## Remaining Gates

- Confirm hosted tests and TypeScript matrix results on the stack heads.
- Complete CLI/bundler target routing and packed namespace import forms. Packed style namespaces currently use named imports.
- Add dynamic/animated values, device-owned objects, and changing host inputs.
- Execute independent iOS/Android renderer controls with pinned device, OS, fonts, density, and tolerances.
- Complete native delivery-size and update measurements before closing release or universal parity gates.
