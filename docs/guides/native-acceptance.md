# Native Acceptance

Static shared authoring compiles through source graphs, file builds, and source-free packages. These checks establish compiler, delivery, and callable behavior. They do not establish iOS or Android layout or rendering parity.

| Boundary              | Evidence                                                          | Verified behavior                                                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source graph          | `src/compiler/Graph.test.ts`                                      | Imported configuration, barrels, token edits, explicit scheme/platform selection, and composition                                                                                                        |
| File host             | `src/node/Host.test.ts`                                           | Native module/maps output, unchanged builds, imported edits, error preservation, and watch recovery                                                                                                      |
| Packed contracts      | `src/compiler/Graph.test.ts`                                      | Web/native publishers, version 21 static recipes, consumer selection, malformed metadata, and re-exports                                                                                                 |
| Consumer package      | `test/fixtures/UniversalLibrary.ts`, `src/compiler/Graph.test.ts` | Actual npm archive without authoring source, independent web/native entry declarations, browser computed styles against plain CSS, and native callable execution                                         |
| CLI target routing    | `src/cli/index.test.ts`                                           | Published native build flags, executed output, no CSS/script artifacts, and incompatible-option diagnostics                                                                                              |
| Vite target routing   | `src/vite/index.test.ts`                                          | Captured native context, imported-theme updates, native bundle execution, and no generated CSS/script delivery                                                                                           |
| Packed namespaces     | `src/compiler/Graph.test.ts`                                      | Namespace imports and re-exports, nested style members, live ordinary exports, consumer type checks, and version 22 contract round trips                                                                 |
| Vite consumer package | `src/vite/index.test.ts`                                          | Source-free package namespace imports through the real resolver, native bundle execution, and browser computed styles against plain CSS                                                                  |
| File-host packages    | `src/node/Host.test.ts`                                           | Import conditions, subpaths, `#imports`, transitive contributions, late installation, atomic metadata changes, export-map edits, linked packages, and failure recovery                                   |
| CLI consumer package  | `src/cli/index.test.ts`                                           | Published executable, source-free web/native consumption, browser computed styles against plain CSS, native execution, dependency-watch repair, and shutdown cleanup                                     |
| Export precedence     | `src/compiler/Native.test.ts`                                     | Explicit local exports take precedence over packed star re-exports                                                                                                                                       |
| Shared DS tokens      | `test/fixtures/native/ds`, `src/compiler/Native.test.ts`          | Pinned core/platform sources, base/inverse and light/dark values, composed spacing, radii, typography, and source-free configuration consumption                                                         |
| Metro packages        | `src/metro/index.test.ts`                                         | Expo 57 resolution, package exports and aliases, outside-root barrels, platform suffixes, npm contracts, executed native values, transitive token edits, error recovery, and offline iOS/Android exports |
| Font delivery         | `src/babel/index.test.ts`, `src/metro/index.test.ts`              | Compiler mappings reach Babel and Metro output; application font registration and device rendering remain separate                                                                                       |
| Native package        | `src/react-native/Exports.test.ts`                                | Packed native declarations, inferred Provider catalogs, numeric variable reads, iOS pod discovery, and Android C++ autolinking outside the workspace                                                     |
| Installed renderer    | `src/react-native/internal/Device.test.ts`                        | Existing Fabric scenarios can resolve dependencies from an installed consumer through `ZYZZ_NATIVE_PROJECT`                                                                                              |

## Reproduction

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm exec vp test src/compiler/Graph.test.ts src/compiler/Native.test.ts src/node/Host.test.ts src/cli/index.test.ts src/vite/index.test.ts --run
pnpm exec vp test src/metro/index.test.ts src/metro/cache.test.ts src/babel/index.test.ts src/react-native/StyleSheet.test.ts --run
pnpm check:types
```

Tests use the repository-pinned toolchain and Chromium from Playwright. Package fixtures compile declarations with the installed TypeScript, pack archives offline, and execute native callables in Node.js. The public graph/host type fixtures also cover invalid native contexts.

`Graph.bench.ts` adds cold native source compilation, unchanged graph reuse, and packed consumption to the Benchmarks workflow. No local timing claim or regression threshold is established by these scenarios.

The DS fixture retains [core variables](https://github.com/tempoxyz/ds/blob/8a03c7c85cfaa56377f224aa9f50d18c6a8e726e/src/core/vars.ts), [platform projections](https://github.com/tempoxyz/ds/blob/8a03c7c85cfaa56377f224aa9f50d18c6a8e726e/src/platform/vars.ts), and configuration. The tests resolve selected tokens into independently specified native values. Responsive tokens remain outside this acceptance.

The adapter preserves the resolver shape used by [Tempro](https://github.com/tempoxyz/tempro/blob/40705e4654d2e7ad3699382db4ea46e5c40d8bdc/apps/mobile/metro.config.js). Zyzz discovers authoring through resolved imports and contracts. Broader third-party component processing remains a separate capability.

[Tempro typography](https://github.com/tempoxyz/tempro/blob/40705e4654d2e7ad3699382db4ea46e5c40d8bdc/apps/mobile/lib/typography.ts) uses native family names and numeric metrics. DS mappings convert authored family strings; they require application assets and device verification. These compiler tests do not establish a Tempro migration or runtime-engine parity.

## Installed Native Package

Build and pack Zyzz before installing the archive in an Expo development-build project outside the repository. Keep Zyzz as an archive dependency. Workspace aliases or links to Zyzz source do not establish published-package delivery.

```sh
pnpm build
pnpm pack --pack-destination /tmp/zyzz-native-pack
pnpm exec vp test src/react-native/Exports.test.ts --run
```

The package test extracts the archive in a temporary external consumer and shares installed framework dependencies. The separate device gate uses a real package-manager installation, native autolinking, and native builds. A type check or autolinking report alone does not establish rendering behavior.

Install the printed archive in the external app, then run Expo prebuild and build each native target. The renderer fixtures require the app identifier `xyz.wevm.zyzz.updates`, plus Reanimated, Worklets, and safe-area-context. Expo Go does not contain the native adapter.

Point the renderer suite at the external project and its built app:

```sh
ZYZZ_NATIVE_PROJECT=/absolute/path/to/consumer \
ZYZZ_NATIVE_IOS_APP=/absolute/path/to/ZyzzNativeUpdates.app \
ZYZZ_NATIVE_IOS_DEVICE='simulator-id' \
pnpm exec vp test src/react-native/internal/Device.test.ts --run --no-file-parallelism
```

Android uses `ZYZZ_NATIVE_ANDROID_APP` for the APK and `ZYZZ_NATIVE_ANDROID_DEVICE` for the emulator serial. The default project remains `examples/react-native`. Both platforms can run in one invocation when both app paths and device identifiers are provided.

The suite starts Metro with the selected project's installed dependencies and compiles fixtures that import `zyzz/react-native`. It verifies geometry, screenshot colors, scoped catalog/scheme changes, render counts, variant choices, animation bindings, refs, cleanup, and errors against the actual native adapter.

The consumer acceptance matrix pins React 19.2.3, RN 0.86.0, Expo 57.0.8, Reanimated 4.5.3, Worklets 0.10.3, safe-area-context 5.7.0, and babel-preset-expo 57.0.4. This matrix covers the styling integrations. Complete application migration, physical devices, wider RN versions, and performance remain separate gates.

## Remaining Gates

- Confirm hosted tests, TypeScript matrices, and benchmark deltas on the shared-package change.
- File-host resolution uses Node import conditions. Metro uses the application's own resolver during server setup. Direct transformer calls retain relative linking; web Metro delivery and packed external asset copying require separate acceptance.
- Theme/configuration factory namespace imports remain unsupported; import these factories by name. Packed style namespaces retain finite native callables, but dynamic recipes still require separate implementation.
- Add dynamic/animated values, device-owned objects, and changing host inputs.
- Execute independent iOS/Android renderer controls with pinned device, OS, fonts, density, and tolerances.
- Complete native delivery-size and update measurements before closing release or universal parity gates.
