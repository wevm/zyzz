# Native Acceptance

Static shared authoring compiles through source graphs, file builds, and source-free packages. These checks establish compiler, delivery, and callable behavior. They do not establish iOS or Android layout or rendering parity.

| Boundary          | Evidence                                                          | Verified behavior                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source graph      | `src/compiler/Graph.test.ts`                                      | Imported configuration, barrels, token edits, explicit scheme/platform selection, and composition                                                                |
| File host         | `src/node/Host.test.ts`                                           | Native module/maps output, unchanged builds, imported edits, error preservation, and watch recovery                                                              |
| Packed contracts  | `src/compiler/Graph.test.ts`                                      | Web/native publishers, version 21 static recipes, consumer selection, malformed metadata, and re-exports                                                         |
| Consumer package  | `test/fixtures/UniversalLibrary.ts`, `src/compiler/Graph.test.ts` | Actual npm archive without authoring source, independent web/native entry declarations, browser computed styles against plain CSS, and native callable execution |
| CLI target routing | `src/cli/index.test.ts` | Published native build flags, executed output, no CSS/script artifacts, and incompatible-option diagnostics |
| Vite target routing | `src/vite/index.test.ts` | Captured native context, imported-theme updates, native bundle execution, and no generated CSS/script delivery |
| Packed namespaces | `src/compiler/Graph.test.ts` | Namespace imports and re-exports, nested style members, live ordinary exports, consumer type checks, and version 22 contract round trips |
| Vite consumer package | `src/vite/index.test.ts` | Source-free package namespace imports through the real resolver, native bundle execution, and browser computed styles against plain CSS |
| File-host packages | `src/node/Host.test.ts` | Import conditions, subpaths, `#imports`, transitive contributions, late installation, atomic metadata changes, export-map edits, linked packages, and failure recovery |
| CLI consumer package | `src/cli/index.test.ts` | Published executable, source-free web/native consumption, browser computed styles against plain CSS, native execution, dependency-watch repair, and shutdown cleanup |
| Export precedence | `src/compiler/Native.test.ts`                                     | Explicit local exports take precedence over packed star re-exports                                                                                               |

## Reproduction

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm exec vp test src/compiler/Graph.test.ts src/compiler/Native.test.ts src/node/Host.test.ts src/cli/index.test.ts src/vite/index.test.ts --run
pnpm check:types
```

Tests use the repository-pinned toolchain and Chromium from Playwright. Package fixtures compile declarations with the installed TypeScript, pack archives offline, and execute native callables in Node.js. The public graph/host type fixtures also cover invalid native contexts.

`Graph.bench.ts` adds cold native source compilation, unchanged graph reuse, and packed consumption to the Benchmarks workflow. No local timing claim or regression threshold is established by these scenarios.

## Remaining Gates

- Confirm hosted tests, TypeScript matrices, and benchmarks on the file-host package stack heads. Local macOS type checks retain the existing `Motion.ts`/`motion.ts` example casing failures.
- File-host resolution uses Node import conditions. TypeScript path aliases, browser/native resolver conditions, and packed external asset copying remain unsupported. Metro remains outside the current integration scope.
- Theme/configuration factory namespace imports remain unsupported; import these factories by name. Packed style namespaces retain finite native callables, but dynamic recipes still require separate implementation.
- Add dynamic/animated values, device-owned objects, and changing host inputs.
- Execute independent iOS/Android renderer controls with pinned device, OS, fonts, density, and tolerances.
- Complete native delivery-size and update measurements before closing release or universal parity gates.
